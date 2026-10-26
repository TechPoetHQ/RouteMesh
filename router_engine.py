import time
import json
import re
import numpy as np

# Load lightweight embedding model (with ultra-fast char-ngram fallback if offline)
try:
    from sentence_transformers import SentenceTransformer
    _model = SentenceTransformer("all-MiniLM-L6-v2")
    USE_ST = True
except Exception:
    _model = None
    USE_ST = False

LOCAL_MEMORY_CACHE = []  # Fallback if Redis container isn't running locally
CACHE_KEY = "routemesh:semantic_cache_v1"
SIMILARITY_THRESHOLD = 0.92

NEGATION_WORDS = {"not", "never", "no", "without", "dont", "don't", "avoid", "except", "exclude"}
REASONING_KEYWORDS = {
    "prove", "optimize", "complexity", "algorithm", "architecture", "debug",
    "refactor", "concurrency", "deadlock", "dynamic programming", "time complexity",
    "distributed", "sql", "regex", "typescript", "python", "implement", "design"
}

def compute_embedding(text: str) -> list[float]:
    clean = text.strip().lower()
    if USE_ST and _model is not None:
        vec = _model.encode(clean, normalize_embeddings=True)
        return vec.tolist()
    # Deterministic 256-dim character 3-gram hash embedding fallback
    vec = np.zeros(256, dtype=np.float32)
    padded = f"  {clean}  "
    for i in range(len(padded) - 2):
        gram = padded[i:i+3]
        idx = hash(gram) % 256
        vec[idx] += 1.0
    norm = np.linalg.norm(vec)
    return (vec / norm).tolist() if norm > 0 else vec.tolist()

def has_negation_flip(prompt_a: str, prompt_b: str) -> bool:
    tokens_a = set(re.findall(r"\b\w+\b", prompt_a.lower()))
    tokens_b = set(re.findall(r"\b\w+\b", prompt_b.lower()))
    neg_a = bool(tokens_a & NEGATION_WORDS)
    neg_b = bool(tokens_b & NEGATION_WORDS)
    return neg_a != neg_b

def score_complexity(prompt: str) -> str:
    words = prompt.split()
    lower = prompt.lower()
    if len(words) > 35 or "```" in prompt:
        return "reasoning"
    hits = sum(1 for kw in REASONING_KEYWORDS if kw in lower)
    return "reasoning" if hits >= 2 else "fast"

async def evaluate_prompt(prompt: str, redis_client=None) -> dict:
    t0 = time.perf_counter()
    tier = score_complexity(prompt)
    query_vec = np.array(compute_embedding(prompt), dtype=np.float32)

    # Fetch cached entries from Redis or local memory
    entries = []
    if redis_client is not None:
        try:
            raw_items = await redis_client.lrange(CACHE_KEY, 0, 199)
            entries = [json.loads(x) for x in raw_items]
        except Exception:
            entries = LOCAL_MEMORY_CACHE
    else:
        entries = LOCAL_MEMORY_CACHE

    best_score = 0.0
    best_response = None
    best_matched_prompt = None

    for item in entries:
        if has_negation_flip(prompt, item["prompt"]):
            continue
        cached_vec = np.array(item["vector"], dtype=np.float32)
        score = float(np.dot(query_vec, cached_vec))
        if score > best_score:
            best_score = score
            best_response = item["response"]
            best_matched_prompt = item["prompt"]

    router_ms = round((time.perf_counter() - t0) * 1000, 2)

    if best_score >= SIMILARITY_THRESHOLD and best_response:
        return {
            "cache_hit": True,
            "cached_response": best_response,
            "matched_prompt": best_matched_prompt,
            "similarity_score": round(best_score, 4),
            "tier": tier,
            "router_latency_ms": router_ms
        }

    return {
        "cache_hit": False,
        "cached_response": None,
        "matched_prompt": None,
        "similarity_score": round(best_score, 4),
        "tier": tier,
        "router_latency_ms": router_ms
    }

async def store_in_cache(prompt: str, response_text: str, redis_client=None):
    entry = {
        "prompt": prompt,
        "vector": compute_embedding(prompt),
        "response": response_text
    }
    LOCAL_MEMORY_CACHE.insert(0, entry)
    if len(LOCAL_MEMORY_CACHE) > 200:
        LOCAL_MEMORY_CACHE.pop()

    if redis_client is not None:
        try:
            await redis_client.lpush(CACHE_KEY, json.dumps(entry))
            await redis_client.ltrim(CACHE_KEY, 0, 199)
        except Exception:
            pass
