# RouteMesh

A prompt router that decides whether a request needs a **cheap** or **expensive** model, then answers it with a local LLM through Ollama.

```
Browser UI -> FastAPI (serve.py) -> classifier + rules -> Ollama (qwen2.5:1.5b or 3b)
```

For which prompts go where, examples, future plans, and limitations, see [ROUTING_GUIDE.md](ROUTING_GUIDE.md).

## Requirements

- Python 3.12 or 3.13 (3.15 is too new for `torch` and `scikit-learn`)
- [Ollama](https://ollama.com/download)
- Internet on first run (downloads `all-MiniLM-L6-v2` once)

## Setup

Put these files in one folder: `serve.py`, `features.py`, `router.joblib`, `requirements.txt`, `prompt-router-local.html`.

Make sure `requirements.txt` includes `requests`, then:

```bash
py -3.12 -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

python -m pip install --upgrade pip
pip install -r requirements.txt

ollama pull qwen2.5:1.5b
ollama pull qwen2.5:3b
```

## Run

1. Make sure Ollama is running (`ollama serve`, or the Ollama tray app).
2. Start the backend from the project folder, with the venv active:

   ```bash
   python -m uvicorn serve:app --host 127.0.0.1 --port 8000
   ```

3. Open `prompt-router-local.html` in your browser and send a prompt.

Check the backend at <http://127.0.0.1:8000/>. It should return `{"status":"ok", ...}`.

## Common problems

| Problem | Fix |
|---|---|
| `No module named 'joblib'` | Activate the venv and run `python -m uvicorn ...` |
| `pip install` fails | Use Python 3.12 or 3.13, and match the scikit-learn version `router.joblib` was trained with |
| UI says "Could not get a response" | Backend or Ollama isn't running |
| First request is slow | Ollama is loading the model, give it a minute |
