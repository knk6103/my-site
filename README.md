# NK (KNK) — Local Development Server

This project now includes a simple local Flask server to support:

- PDF/text upload + text extraction (for client-side indexing)
- Persistent storage (SQLite) and full-text search (FTS if available)
- OpenAI proxy endpoint for LLM summarization (requires `OPENAI_API_KEY` env var)

Quick start (Windows PowerShell):

```powershell
cd "c:\Users\gram16\Desktop\학교_한양대_광학\수업_기계공학개론\my site"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# (OPTIONAL) set your OpenAI key for AI proxy
$env:OPENAI_API_KEY = 'sk-...'

python server.py

# Open in browser:
# http://localhost:8000/           (static site)
# http://127.0.0.1:5000/research.html  (server runs on :5000 but static files served by built-in http.server on :8000)
```

Notes:
- The server stores uploaded files in `uploads/` and metadata in `research.db` (SQLite).
- The OpenAI proxy will forward requests to OpenAI; do not commit API keys to source control.
- This setup is for local development only.
