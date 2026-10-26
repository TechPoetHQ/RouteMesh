
import joblib
import requests

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

from features import featurize, hand_features, apply_rules


# App setup
app = FastAPI(title="RouteMesh API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the existing router
enc = SentenceTransformer("all-MiniLM-L6-v2")
m = joblib.load("router.joblib")

OLLAMA_URL = "http://localhost:11434/api/generate"

# The tier determines which model actually generates the answer.
MODEL_MAP = {
    "cheap": "qwen2.5:1.5b",
    "expensive": "qwen2.5:3b",
}


class Req(BaseModel):
    prompt: str


@app.get("/")
def home():
    return {
        "status": "ok",
        "app": "RouteMesh",
        "models": MODEL_MAP,
    }


@app.post("/predict")
def predict(r: Req):
    prompt = r.prompt.strip()

    if not prompt:
        raise HTTPException(
            status_code=400,
            detail="Please enter a prompt."
        )

    # 1. Predict task and tier using your existing classifier.
    x = featurize([prompt], enc)

    tp = m["task"].predict_proba(x)[0]
    rp = m["tier"].predict_proba(x)[0]

    task = str(m["task"].classes_[tp.argmax()])
    tier = str(m["tier"].classes_[rp.argmax()])

    confidence = float((tp.max() + rp.max()) / 2)

    # 2. Apply your existing routing rules.
    task, tier, reasons = apply_rules(prompt, task, tier)

    if reasons:
        confidence = max(confidence, 0.95)

    hf = hand_features(prompt)

    if hf[3]:
        reasons.append("Contains an error or stack trace")
    if hf[4]:
        reasons.append("Mentions versions or recent changes")
    if hf[5]:
        reasons.append("Architecture or tradeoff language")
    if hf[2] or hf[1] > 1.5:
        reasons.append("Includes pasted code or multiple lines")

    reasons.append(
        f"Classifier: task {m['task'].classes_[tp.argmax()]} "
        f"({tp.max():.0%}), tier "
        f"{m['tier'].classes_[rp.argmax()]} ({rp.max():.0%})"
    )

    # 3. Choose the actual model using the final tier.
    normalized_tier = tier.strip().lower()

    if normalized_tier not in MODEL_MAP:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Unknown tier '{tier}'. Expected 'cheap' or "
                "'expensive'. Check your classifier labels and apply_rules()."
            ),
        )

    selected_model = MODEL_MAP[normalized_tier]

    # 4. Generate an answer with the selected Ollama model.
    ollama_prompt = f"""You are RouteMesh, a helpful assistant.
Answer the user's request accurately and directly.
Keep the answer concise unless more detail is necessary.
For coding requests, provide working code and a brief explanation.

User request:
{prompt}
"""

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": selected_model,
                "prompt": ollama_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 300,
                },
            },
            timeout=180,
        )
        response.raise_for_status()
        result = response.json()
        answer = result.get("response", "").strip()

        if not answer:
            answer = "The selected model returned an empty answer."

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Could not generate an answer using {selected_model}. "
                "Check that Ollama is running and the model is installed. "
                f"Details: {exc}"
            ),
        ) from exc

    # 5. Return the answer and routing information to the UI.
    return {
        "answer": answer,
        "task": task,
        "tier": tier,
        "confidence": confidence,
        "reasons": reasons,
        "answer_model": selected_model,
    }
