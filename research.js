/*
  research.js — client-side research manager
  - Stores uploaded files and manual entries in IndexedDB
  - Builds a Fuse.js index for fuzzy search over titles/abstracts
  - Provides an AI-prompt generator (client-side helper only)
*/

(function(){
  const DB_NAME = 'research-db';
  const DB_VERSION = 1;
  let db = null;

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains('files')) idb.createObjectStore('files', {keyPath: 'id', autoIncrement: true});
        if(!idb.objectStoreNames.contains('entries')) idb.createObjectStore('entries', {keyPath: 'id', autoIncrement: true});
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(storeName, value){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const r = store.add(value);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  function idbGetAll(storeName){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  // UI elements
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');
  const entryForm = document.getElementById('entry-form');
  const clearEntriesBtn = document.getElementById('clear-entries');
  const aiQuery = document.getElementById('ai-query');
  const runSearchBtn = document.getElementById('run-search');
  const resultsEl = document.getElementById('search-results');
  const aiPromptEl = document.getElementById('ai-prompt');
  const openAIPromptBtn = document.getElementById('open-ai-prompt');
  const copyPromptBtn = document.getElementById('copy-prompt');
  const clearPromptBtn = document.getElementById('clear-prompt');

  let fuse = null;
  let currentIndex = [];

  function renderFileList(files){
    fileList.innerHTML = '';
    if(files.length === 0){
      fileList.innerHTML = '<p class="muted">No uploaded files yet.</p>';
      return;
    }
    files.forEach(f => {
      const el = document.createElement('div');
      el.className = 'file-item';
      const date = new Date(f.added).toLocaleString();
      const name = document.createElement('div');
      name.innerHTML = `<strong>${escapeHtml(f.name)}</strong> <div class="muted">${f.type} • ${f.size} bytes • ${date}</div>`;
      const btns = document.createElement('div');
      btns.style.marginTop = '8px';
      const dl = document.createElement('button');
      dl.className = 'btn';
      dl.textContent = 'Download';
      dl.addEventListener('click', async ()=>{
        // retrieve blob
        const tx = db.transaction('files','readonly');
        const store = tx.objectStore('files');
        const r = store.get(f.id);
        r.onsuccess = () => {
          const rec = r.result;
          if(!rec) return alert('File not found');
          const blob = rec.blob;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = rec.name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(()=>URL.revokeObjectURL(url), 5000);
        };
      });
      btns.appendChild(dl);
      el.appendChild(name);
      el.appendChild(btns);
      fileList.appendChild(el);
    });
  }

  function escapeHtml(s){ return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

  async function buildIndex(){
    const entries = await idbGetAll('entries');
    // include text from uploaded text files if available
    const files = await idbGetAll('files');
    const textDocs = files.filter(f => f.text);
    const fileEntries = textDocs.map(f => ({ title: f.name, authors: '', year: '', type: 'file', abstract: f.text || '' }));
    currentIndex = entries.concat(fileEntries);
    fuse = new Fuse(currentIndex, { keys: ['title','abstract','authors'], threshold: 0.35 });
  }

  function renderResults(list){
    resultsEl.innerHTML = '';
    if(!list || list.length === 0){
      resultsEl.innerHTML = '<p class="muted">No results.</p>';
      return;
    }
    list.forEach(item => {
      const el = document.createElement('div');
      el.className = 'entry-card';
      const t = document.createElement('h4'); t.textContent = item.title || '(no title)';
      const meta = document.createElement('div'); meta.className = 'muted'; meta.textContent = `${item.type || ''} ${item.authors || ''} ${item.year ? '• '+item.year : ''}`;
      const ab = document.createElement('p'); ab.textContent = item.abstract ? (item.abstract.length>300?item.abstract.slice(0,300)+'...':item.abstract) : '';
      el.appendChild(t); el.appendChild(meta); el.appendChild(ab);
      resultsEl.appendChild(el);
    });
  }

  async function doSearch(q){
    if(!fuse) await buildIndex();
    if(!q) { renderResults([]); return; }
    const r = fuse.search(q);
    const list = r.map(x => x.item);
    renderResults(list);
    // fill AI prompt area with sample prompt
    aiPromptEl.value = `Summarize the following research query and suggest relevant keywords and potential citations:\n\nQuery: ${q}\n\nFocus on laser beam shaping, optical design, and nonlinear optics.`;
  }

  // event handlers
  // Upload files: try server endpoint first, fallback to IndexedDB
  fileInput && fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    const useServer = await (async function(){
      try{ const r = await fetch('/api/ping'); return r.ok; }catch(err){ return false; }
    })();
    if(useServer){
      for(const f of files){
        const fd = new FormData(); fd.append('file', f);
        try{
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const j = await res.json();
          if(!j.ok) console.warn('Upload failed', j);
        }catch(err){ console.error('Upload error', err); }
      }
      // refresh via server search index
      const fs = await fetch('/api/search?q=');
      // attempt to render files by querying entries with empty q (server returns empty results by design)
      const all = await idbGetAll('files');
      renderFileList(all);
      await buildIndex();
      return;
    }
    // fallback: store in IndexedDB
    for(const f of files){
      const blob = f.slice(0, f.size, f.type);
      const rec = { name: f.name, type: f.type || 'application/octet-stream', size: f.size, added: Date.now(), blob: blob };
      if(f.type.startsWith('text') || f.name.endsWith('.md')){
        const text = await f.text(); rec.text = text;
      }
      await idbPut('files', rec);
    }
    const all = await idbGetAll('files');
    renderFileList(all);
    await buildIndex();
  });

  // Save manual entry: prefer server API, fallback to IndexedDB
  entryForm && entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('entry-title').value.trim();
    const authors = document.getElementById('entry-authors').value.trim();
    const year = document.getElementById('entry-year').value.trim();
    const type = document.getElementById('entry-type').value;
    const abstract = document.getElementById('entry-abstract').value.trim();
    if(!title) return alert('Title is required');
    const useServer = await (async function(){ try{ const r = await fetch('/api/ping'); return r.ok; }catch(err){ return false; } })();
    if(useServer){
      try{
        const res = await fetch('/api/entry', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, authors, year, type, abstract }) });
        const j = await res.json();
        if(j.ok){ entryForm.reset(); await buildIndex(); alert('Entry saved on server'); return; }
      }catch(err){ console.error('Server save error', err); }
    }
    // fallback local
    await idbPut('entries', { title, authors, year, type, abstract, added: Date.now() });
    entryForm.reset();
    await buildIndex();
    alert('Entry saved locally');
  });

  clearEntriesBtn && clearEntriesBtn.addEventListener('click', async ()=>{
    if(!confirm('모든 엔트리를 삭제하시겠습니까? (파일은 별도 삭제되어야 합니다)')) return;
    const tx = db.transaction('entries','readwrite');
    const store = tx.objectStore('entries');
    store.clear();
    await buildIndex();
    alert('Entries cleared');
  });

  runSearchBtn && runSearchBtn.addEventListener('click', async ()=>{
    const q = aiQuery.value.trim();
    const useServer = await (async function(){ try{ const r = await fetch('/api/ping'); return r.ok; }catch(err){ return false; } })();
    if(useServer){
      try{
        const res = await fetch('/api/search?q='+encodeURIComponent(q));
        const j = await res.json();
        renderResults(j.results || []);
        // fill AI prompt area
        aiPromptEl.value = `Summarize the following research query and suggest relevant keywords and potential citations:\n\nQuery: ${q}`;
        return;
      }catch(err){ console.error('Server search failed', err); }
    }
    doSearch(q);
  });

  openAIPromptBtn && openAIPromptBtn.addEventListener('click', async ()=>{
    const q = aiQuery.value.trim();
    const useServer = await (async function(){ try{ const r = await fetch('/api/ping'); return r.ok; }catch(err){ return false; } })();
    if(useServer){
      // call server AI proxy if available
      try{
        const prompt = `Please provide a concise summary (3-6 sentences) and 5 suggested keywords for the query:\n\nQuery: ${q}`;
        const res = await fetch('/api/ai', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
        const j = await res.json();
        // handle OpenAI response shape
        const content = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : (j.choices && j.choices[0] && j.choices[0].text ? j.choices[0].text : JSON.stringify(j));
        aiPromptEl.value = content || prompt;
        return;
      }catch(err){ console.error('AI proxy failed', err); }
    }
    aiPromptEl.value = `Please provide a concise summary (3-6 sentences) and 5 suggested keywords for the query:\n\nQuery: ${q}`;
    aiPromptEl.focus();
  });

  copyPromptBtn && copyPromptBtn.addEventListener('click', ()=>{
    aiPromptEl.select();
    document.execCommand('copy');
    copyPromptBtn.textContent = 'Copied';
    setTimeout(()=>copyPromptBtn.textContent = 'Copy Prompt', 2000);
  });

  clearPromptBtn && clearPromptBtn.addEventListener('click', ()=>{ aiPromptEl.value = ''; });

  // init
  (async function init(){
    await openDB();
    const fs = await idbGetAll('files');
    renderFileList(fs);
    await buildIndex();
  })();

})();
