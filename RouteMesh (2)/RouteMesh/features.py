import re, math, numpy as np

FRESH  = re.compile(r"\b(latest|deprecated|release notes|changelog|still (supported|maintained)|new in|what changed|breaking changes?)\b|\bv?\d+\.\d+(\.\d+)?\b", re.I)
TRACE  = re.compile(r"traceback|exception|error:|stack trace|segfault|at line \d+|\bpanic\b|undefined is not|panicked", re.I)
DESIGN = re.compile(r"architecture|scal(e|ab)|trade-?offs?|system design|microservice|multi-tenant|throughput|high availability", re.I)
SHELL  = re.compile(r"\b(regex|sql|bash|shell|awk|sed|cron|dockerfile|docker|curl|git)\b", re.I)
CODEKW = re.compile(r"\b(def|class|function|import|return|const|let|var|public|void|SELECT|FROM)\b")
REFAC  = re.compile(r"\b(refactor|clean up|review|optimi[sz]e|rewrite|simplify)\b", re.I)

def hand_features(p):
    words = len(p.split())
    return [math.log1p(words), math.log1p(p.count("\n")), float("```" in p),
            float(bool(TRACE.search(p))), float(bool(FRESH.search(p))),
            float(bool(DESIGN.search(p))), float(bool(SHELL.search(p))),
            float(bool(CODEKW.search(p))), float(bool(REFAC.search(p))),
            p.count("?")/3.0]

def featurize(texts, encoder):
    texts = list(texts)
    emb = encoder.encode(texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    hand = np.array([hand_features(t) for t in texts])
    return np.hstack([emb, hand])

# ---- safety rules for obvious cases ----
STRONG_TRACE = re.compile(r"traceback \(most recent call last\)|^\s*File \".+\", line \d+|segmentation fault|segfault|\b[A-Za-z_.]*(Error|Exception):|\bpanic:|exit code \d+", re.I | re.M)
FRESH_KW = re.compile(r"\b(latest|deprecated|release notes|changelog|what changed|what'?s new|whats new|still maintained|still supported|breaking changes?|is out yet|out yet)\b", re.I)
NOW_KW = re.compile(r"\b(weather|latest news|news on|live score|score of|who won|current (president|prime minister|ceo|champion)|election results|stock price)\b", re.I)
CODE_ASK = re.compile(r"\b(write|create|implement|function|script|query|regex|command|code|build|make|convert|refactor|git|sql|bash|file|files)\b", re.I)

def apply_rules(p, task, tier):
    why = []
    if STRONG_TRACE.search(p) and task != "debug":
        task = "debug"; why.append("Rule: contains an error or stack trace, so debug")
    elif FRESH_KW.search(p) and "```" not in p and not CODE_ASK.search(p) and task != "docs":
        task = "docs"; why.append("Rule: asks about latest or deprecated things, so it needs fresh info")
    elif NOW_KW.search(p) and "```" not in p and not CODE_ASK.search(p) and task in ("general", "explain"):
        task = "docs"; why.append("Rule: needs live or current information, so search")
    if task == "debug" and STRONG_TRACE.search(p) and p.count("\n") >= 3 and tier != "expensive":
        tier = "expensive"; why.append("Rule: multi-line stack trace needs a stronger model")
    return task, tier, why

# ---- routing table (keys match MODELS in the web page) ----
ROUTES = {
    "debug":   {"expensive": "claude", "cheap": "codeS"},
    "design":  {"expensive": "reason", "cheap": "claude"},
    "code":    {"expensive": "claude", "cheap": "codeS"},
    "explain": {"expensive": "claude", "cheap": "mini"},
    "docs":    {"expensive": "search", "cheap": "search"},
    "general": {"expensive": "claude", "cheap": "mini"},
}
def route(task, tier): return ROUTES[task][tier]
