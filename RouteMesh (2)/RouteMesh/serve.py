
import os
import time

import joblib
import requests

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

from features import featurize, hand_features, apply_rules, route


# --------------------------------------------------
# 1. Initialize RouteMesh
# --------------------------------------------------

app = FastAPI(title="RouteMesh API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

enc = SentenceTransformer("all-MiniLM-L6-v2")
m = joblib.load("router.joblib")


class Req(BaseModel):
    prompt: str


UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui")
OLLAMA_URL = "http://localhost:11434"
ANSWER_MODEL = "qwen2.5:1.5b"


# --------------------------------------------------
# 1b. Web UI + status
# --------------------------------------------------

@app.get("/app", include_in_schema=False)
def open_ui():
    return RedirectResponse("/ui/")


@app.get("/api/status")
def status():
    """Report whether Ollama is reachable and the answer model is installed."""
    info = {
        "backend": True,
        "ollama": False,
        "model_installed": False,
        "model": ANSWER_MODEL,
        "tasks": [str(c) for c in m["task"].classes_],
        "tiers": [str(c) for c in m["tier"].classes_],
    }
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        r.raise_for_status()
        info["ollama"] = True
        names = [x.get("name", "") for x in r.json().get("models", [])]
        info["model_installed"] = ANSWER_MODEL in names
    except requests.RequestException:
        pass
    return info


# --------------------------------------------------
# 2. Health check
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "status": "running",
        "app": "RouteMesh",
        "answer_provider": "Ollama",
        "model": "qwen2.5:1.5b",
    }


# --------------------------------------------------
# 3. Predict route and generate answer
# --------------------------------------------------

@app.post("/predict")
def predict(r: Req):

    if not r.prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="Prompt cannot be empty.",
        )

    t0 = time.perf_counter()

    # Step A: Classify the user's prompt
    x = featurize([r.prompt], enc)

    tp = m["task"].predict_proba(x)[0]
    rp = m["tier"].predict_proba(x)[0]

    task = str(m["task"].classes_[tp.argmax()])
    tier = str(m["tier"].classes_[rp.argmax()])

    conf = float((tp.max() + rp.max()) / 2)

    # Step B: Apply existing RouteMesh rules
    task, tier, why = apply_rules(r.prompt, task, tier)

    if why:
        conf = max(conf, 0.95)

    # Step C: Add explanations from hand-crafted features
    hf = hand_features(r.prompt)

    if hf[3]:
        why.append("Contains an error or stack trace")

    if hf[4]:
        why.append("Mentions versions or recent changes")

    if hf[5]:
        why.append("Architecture or tradeoff language")

    if hf[2] or hf[1] > 1.5:
        why.append("Includes pasted code or multiple lines")

    why.append(
        f"Model view: task "
        f"{m['task'].classes_[tp.argmax()]} ({tp.max():.0%}), "
        f"tier {m['tier'].classes_[rp.argmax()]} ({rp.max():.0%})"
    )

    route_ms = round((time.perf_counter() - t0) * 1000)
    task_probs = {
        str(c): round(float(p), 4) for c, p in zip(m["task"].classes_, tp)
    }
    tier_probs = {
        str(c): round(float(p), 4) for c, p in zip(m["tier"].classes_, rp)
    }
    # The trained classifier also emits generate / refactor / shell, which the
    # routing table groups under "code".
    route_task = {"generate": "code", "refactor": "code", "shell": "code"}.get(task, task)
    try:
        routed_to = route(route_task, tier)
    except KeyError:
        routed_to = None
    t1 = time.perf_counter()
    answer = ""
    answer_error = None

    # Step D: Generate the actual answer with local Ollama
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5:1.5b",
                "prompt": (
                    "You are a helpful AI assistant. Answer the user's "
                    "question accurately and concisely. For coding "
                    "questions, give the simplest correct solution first "
                    "and a brief explanation of at most two sentences. "
                    "Avoid unnecessary headings, long comments, and "
                    "extra examples unless requested.\n\n"
                    f"User question: {r.prompt}\n\n"
                    "Answer:"
                ),
                "stream": False,
                "options": {
                    "num_predict": 180,
                    "temperature": 0.3,
                },
            },
            timeout=180,
        )

        response.raise_for_status()
        answer = response.json().get("response", "").strip()

        if not answer:
            answer_error = "Ollama returned an empty answer."

    except requests.Timeout:
        answer_error = "Ollama took too long to respond. Please try again."

    except requests.RequestException:
        answer_error = (
            "Could not connect to Ollama. Install it from https://ollama.com, "
            "start it, and run: ollama pull qwen2.5:1.5b"
        )

    # Step E: Return answer and routing information
    return {
        "answer": answer,
        "answer_error": answer_error,
        "task": task,
        "tier": tier,
        "confidence": round(conf, 4),
        "reasons": why,
        "answer_model": "qwen2.5:1.5b",
        "routed_to": routed_to,
        "task_probs": task_probs,
        "tier_probs": tier_probs,
        "route_ms": route_ms,
        "answer_ms": round((time.perf_counter() - t1) * 1000),
    }


# --------------------------------------------------
# 4. Mount the UI last so API routes take priority
# --------------------------------------------------

if os.path.isdir(UI_DIR):
    app.mount("/ui", StaticFiles(directory=UI_DIR, html=True), name="ui")
