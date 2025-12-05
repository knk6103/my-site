#!/usr/bin/env python3
"""
Simple Flask server for research uploads, text extraction, search, and OpenAI proxy.

Endpoints:
 - POST /api/upload -> file upload (saves file, extracts text for PDFs/txt/md)
 - POST /api/entry  -> save manual entry JSON
 - GET  /api/search?q=... -> returns matches from SQLite FTS
 - POST /api/ai    -> proxy to OpenAI (requires OPENAI_API_KEY env var)
 - GET  /api/ping  -> health check

This is a lightweight development server intended for local testing only.
Do NOT expose this to the public without adding authentication.
"""
import os
import sqlite3
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from pathlib import Path
import datetime

UPLOAD_DIR = Path(__file__).parent / 'uploads'
DB_PATH = Path(__file__).parent / 'research.db'
ALLOWED_EXT = {'.pdf', '.txt', '.md'}

UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__, static_folder='')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # entries table stores metadata and extracted text
    c.execute('''CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        authors TEXT,
        year TEXT,
        type TEXT,
        abstract TEXT,
        text TEXT,
        filename TEXT,
        added INTEGER
    )''')
    # Create FTS virtual table for full-text search
    try:
        c.execute('CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(title, authors, abstract, text, content="entries", content_rowid="id")')
    except Exception:
        # Some sqlite builds may not support FTS5; fallback to simple table search
        pass
    conn.commit()
    conn.close()

def extract_text_from_pdf(path):
    # Use pdfminer.six if available; otherwise return empty string
    try:
        from pdfminer.high_level import extract_text
        return extract_text(str(path)) or ''
    except Exception:
        return ''

def index_entry(conn, rowid):
    # If FTS5 is available, insert into FTS table
    try:
        c = conn.cursor()
        c.execute('INSERT INTO entries_fts(rowid, title, authors, abstract, text) SELECT id, title, authors, abstract, text FROM entries WHERE id=?', (rowid,))
        conn.commit()
    except Exception:
        pass

@app.route('/api/ping')
def ping():
    return jsonify({'ok': True, 'time': datetime.datetime.utcnow().isoformat()})

@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'missing file'}), 400
    f = request.files['file']
    filename = secure_filename(f.filename)
    ext = Path(filename).suffix.lower()
    saved = UPLOAD_DIR / filename
    f.save(saved)
    text = ''
    if ext == '.pdf':
        text = extract_text_from_pdf(saved)
    elif ext in ('.txt', '.md'):
        try:
            text = saved.read_text(encoding='utf-8')
        except Exception:
            text = ''
    # store metadata in DB
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO entries (title, authors, year, type, abstract, text, filename, added) VALUES (?,?,?,?,?,?,?,?)', (
        filename, '', '', 'file', '', text, filename, int(datetime.datetime.utcnow().timestamp())
    ))
    rowid = c.lastrowid
    conn.commit()
    index_entry(conn, rowid)
    conn.close()
    return jsonify({'ok': True, 'id': rowid, 'filename': filename})

@app.route('/api/entry', methods=['POST'])
def add_entry():
    data = request.get_json() or {}
    title = data.get('title', '')
    authors = data.get('authors', '')
    year = data.get('year', '')
    typ = data.get('type', 'paper')
    abstract = data.get('abstract', '')
    text = data.get('text', '')
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO entries (title, authors, year, type, abstract, text, filename, added) VALUES (?,?,?,?,?,?,?,?)', (
        title, authors, year, typ, abstract, text, '', int(datetime.datetime.utcnow().timestamp())
    ))
    rowid = c.lastrowid
    conn.commit()
    index_entry(conn, rowid)
    conn.close()
    return jsonify({'ok': True, 'id': rowid})

@app.route('/api/search')
def api_search():
    q = request.args.get('q', '').strip()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    results = []
    if not q:
        conn.close()
        return jsonify({'results': []})
    # try FTS search
    try:
        c.execute('SELECT e.id, e.title, e.authors, e.year, e.type, e.abstract, e.filename FROM entries_fts f JOIN entries e ON f.rowid=e.id WHERE entries_fts MATCH ? ORDER BY rank', (q,))
        rows = c.fetchall()
    except Exception:
        # fallback to LIKE search
        likeq = f'%{q}%'
        c.execute('SELECT id, title, authors, year, type, abstract, filename FROM entries WHERE title LIKE ? OR abstract LIKE ? OR text LIKE ? LIMIT 200', (likeq, likeq, likeq))
        rows = c.fetchall()
    for r in rows:
        results.append({'id': r[0], 'title': r[1], 'authors': r[2], 'year': r[3], 'type': r[4], 'abstract': r[5], 'filename': r[6]})
    conn.close()
    return jsonify({'results': results})

@app.route('/api/ai', methods=['POST'])
def api_ai():
    # Proxy to OpenAI Chat completions (requires OPENAI_API_KEY env var)
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return jsonify({'error': 'OPENAI_API_KEY not set on server'}), 500
    data = request.get_json() or {}
    prompt = data.get('prompt', '')
    if not prompt:
        return jsonify({'error': 'missing prompt'}), 400
    # Use requests to call OpenAI API to avoid adding heavy deps
    import requests
    headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'gpt-4o-mini',
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 400
    }
    r = requests.post('https://api.openai.com/v1/chat/completions', json=payload, headers=headers)
    try:
        return jsonify(r.json())
    except Exception:
        return jsonify({'error': 'AI request failed', 'status': r.status_code, 'text': r.text}), 500

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(str(UPLOAD_DIR), filename)

if __name__ == '__main__':
    init_db()
    app.run(host='127.0.0.1', port=5000, debug=True)
