# RouteMesh Routing Guide

RouteMesh looks at each prompt and decides two things:

1. **Task**: what kind of request it is (`generate`, `debug`, `refactor`, `explain`, `shell`, `docs`, `design`)
2. **Tier**: how much model power it needs (`cheap` or `expensive`)

The tier picks the model that writes the answer (see `MODEL_MAP` in `serve.py`):

| Tier | Model | Used for |
|---|---|---|
| `cheap` | `qwen2.5:1.5b` | Short, well-defined, low-risk requests |
| `expensive` | `qwen2.5:3b` | Long, multi-step, or high-stakes requests |

---

## How the decision is made

1. **Classifier**: Logistic Regression on top of `all-MiniLM-L6-v2` sentence embeddings plus 10 hand-built features (word count, line count, code fences, error/stack-trace words, version numbers, design words, shell words, code keywords, refactor words, question marks).
2. **Safety rules** (`apply_rules` in `features.py`): override the classifier for obvious cases. A real stack trace forces `debug`, and a multi-line stack trace forces `expensive`.

---

## Rules of thumb

- **Short + one job** -> cheap
- **Pasted code or a multi-line error** -> expensive
- **"Design", "architecture", "tradeoffs"** -> expensive
- **"Latest", "deprecated", version numbers** -> `docs` task (cheap)
- **"In depth", "edge cases", "internals"** -> expensive

---

## CHEAP tier: what goes here

- Short "write a function that..." requests (under ~40 words)
- One-line error questions with no stack trace
- Quick explanations of a single concept
- Shell, regex, and SQL one-liners
- Docs and version lookups
- Small refactor questions with no pasted code

### 13 cheap examples

| # | Prompt | Task | Why cheap |
|---|---|---|---|
| 1 | `write a function to check palindrome` | generate | Short, one clear job |
| 2 | `whats the difference between let and const` | explain | Single concept |
| 3 | `kill process on port 8080` | shell | One-line command |
| 4 | `regex for indian phone numbers` | shell | Small regex lookup |
| 5 | `is pydantic v3 out yet and what broke` | docs | Version lookup |
| 6 | `latest next.js version and does app router still need use client` | docs | Fresh-info question, short |
| 7 | `why am I getting KeyError: 'user_id'` | debug | Single error line, no trace |
| 8 | `how can I clean up nested ifs?` | refactor | Short, no code pasted |
| 9 | `explain git rebase simply` | explain | Short concept question |
| 10 | `bash one-liner to find files larger than 100MB` | shell | One-line command |
| 11 | `what changed in FastAPI 0.110?` | docs | Release-notes lookup |
| 12 | `how do I undo the last git commit` | shell | Standard git command |
| 13 | `write a SQL query to get the top 5 customers by order count` | shell | Short query, one table idea |

---

## EXPENSIVE tier: what goes here

- Pasted stack traces and multi-line errors
- System design and architecture questions with tradeoffs
- Long, detailed "build me a script that..." requests
- Refactor or optimize requests with pasted code
- "Explain in depth" requests covering internals and edge cases

### 13 expensive examples

| # | Prompt | Task | Why expensive |
|---|---|---|---|
| 1 | `write a python script that watches a folder and uploads new files to s3 with retries and logging` | generate | Long, several requirements |
| 2 | `how would you design a collaborative editor like google docs, conflict resolution, offline mode` | design | Architecture and tradeoffs |
| 3 | `Design a rate limiter for a public API that scales to 10k requests per second. Compare Redis vs Memcached.` | design | System design plus comparison |
| 4 | A pasted `Traceback (most recent call last): ...` (3+ lines) followed by "Why does this happen intermittently?" | debug | Multi-line trace (rule forces expensive) |
| 5 | `make this function faster:` followed by a pasted code block | refactor | Pasted code needs real reading |
| 6 | `Explain in depth how async/await works internally, cover edge cases and failure modes, and how it interacts with concurrency.` | explain | Deep, multi-part explanation |
| 7 | `System design: payments ledger, needs exactly-once processing. What are the failure modes?` | design | Reliability and failure analysis |
| 8 | `Refactor this to be more readable and efficient:` followed by a code block | refactor | Code in the prompt |
| 9 | `How should I architect a notification service? It serves 5M daily users.` | design | Scale-driven architecture |
| 10 | `Design a multi-tenant job queue that has to survive a regional outage. Compare Kafka vs SQS and explain the tradeoffs.` | design | Multi-part design question |
| 11 | `Explain in depth how a mutex works internally, cover edge cases and failure modes, and how it interacts with concurrency.` | explain | Internals plus edge cases |
| 12 | `Build a FastAPI service with JWT auth, rate limiting, Postgres models, and unit tests. Include error handling and a Dockerfile.` | generate | Long, multi-file request |
| 13 | A pasted Java or Go stack trace plus "It only fails in production, not locally. What could be different?" | debug | Trace plus open-ended diagnosis |

> These follow the patterns the router was trained and tested on. It is a statistical classifier, so borderline prompts can land on either side. To see exactly what it decides, paste a prompt into the UI and check **Routing result** and **Why this route was chosen**.

---

## Future implementation: route by type of work, not just difficulty

Right now RouteMesh only answers "how hard is this?" The next step is also answering "what kind of work is this?" and sending each combination to the best model for it.

```
Prompt -> [work type: coding / research / writing / math / chat] x [tier: cheap / expensive] -> model
```

| Work type | Cheap tier | Expensive tier |
|---|---|---|
| **Coding** | Small code model (e.g. `qwen2.5-coder:1.5b`) | Larger code model (e.g. `qwen2.5-coder:7b`) |
| **Research / current info** | Web search + small summarizer | Web search + larger model with citations |
| **Reasoning / math** | Small general model | Reasoning-tuned model (e.g. `deepseek-r1`) |
| **Writing / docs** | Small general model | Larger general model |
| **General chat** | Smallest model | Mid-size general model |

Other planned improvements:

- **Work-type classifier**: add labels like `research`, `writing`, `math`, `chat` to the training data, so non-developer prompts are routed correctly.
- **Real fresh-info path**: the `docs` task currently just goes to a local model that can't browse. Route it to a search or RAG step instead.
- **Confidence-based escalation**: if the router's confidence is low, or the cheap model's answer looks weak, retry with the expensive model automatically.
- **Feedback loop**: add thumbs up/down in the UI and log wrong routes to retrain the classifier on real usage.
- **More than two tiers**: add a `mid` tier (or a 7B model) between cheap and expensive.
- **Cost and latency dashboard**: show tokens, response time, and estimated savings versus always using the big model.
- **Streaming answers** and conversation history in the UI.
- **Cleaner label set**: align `ROUTES` in `features.py` with the real training labels and use it as the routing table.

---

## Limitations

- **Only two models.** Every request goes to either `qwen2.5:1.5b` or `qwen2.5:3b`. Both are small and from the same family, so the "expensive" model is only moderately stronger, and hard problems can still get weak answers.
- **Built mostly for developers.** The training data is code datasets (MBPP, CodeAlpaca, Magicoder, SQL) plus templates for debugging, design, docs, and shell tasks. Prompts about research, writing, math, or everyday questions are outside what it learned, so they may be misrouted or get a low-quality tier.
- **Routes by difficulty, not by domain.** It doesn't yet pick a model specialized for the kind of work (see the future section above).
- **Tier labels are heuristic.** In the training data, "cheap vs expensive" is partly decided by prompt length (under or over ~40 words) and by template, not by measured model performance. A short prompt can still be hard, and a long one easy.
- **Synthetic training data.** Many debug, design, docs, and shell examples are generated from templates, so the router is best on prompts that look like those templates and less reliable on unusual phrasing.
- **No live information.** The `docs` task flags "latest/deprecated" questions, but the answer still comes from a local model with a fixed knowledge cutoff, so version info can be outdated or wrong.
- **English only**, and prompts are judged one at a time with no conversation history.
- **Short answers.** `num_predict` is capped at 300 tokens, so long code can get cut off.
- **Local hardware bound.** Speed depends on your CPU/GPU, and the first request after startup is slow while Ollama loads the model.

---

## Changing the behavior

- **Swap models**: edit `MODEL_MAP` in `serve.py`.
- **Add or tweak rules**: edit `apply_rules()` in `features.py`.
- **Retrain**: run `router_training.ipynb`, then replace `router.joblib` and `features.py`.
