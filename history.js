/* history.js — Activities / Research History manager (IndexedDB) */
(function(){
  const DB_NAME = 'history-db';
  const DB_VERSION = 1;
  let db = null;
  let editingId = null;

  function openDB(){
    return new Promise((resolve,reject)=>{
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains('activities')) idb.createObjectStore('activities', {keyPath:'id', autoIncrement:true});
      };
      r.onsuccess = () => { db = r.result; resolve(db); };
      r.onerror = () => reject(r.error);
    });
  }

  function idbPut(val){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('activities','readwrite');
      const store = tx.objectStore('activities');
      const req = val.id ? store.put(val) : store.add(val);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGetAll(){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('activities','readonly');
      const store = tx.objectStore('activities');
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  function idbDelete(id){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('activities','readwrite');
      const store = tx.objectStore('activities');
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  // DOM refs
  const form = document.getElementById('history-form');
  const titleEl = document.getElementById('hist-title');
  const researcherEl = document.getElementById('hist-researcher');
  const categoryEl = document.getElementById('hist-category');
  const roleEl = document.getElementById('hist-role');
  const startEl = document.getElementById('hist-start');
  const endEl = document.getElementById('hist-end');
  const ongoingEl = document.getElementById('hist-ongoing');
  const statusEl = document.getElementById('hist-status');
  const descEl = document.getElementById('hist-desc');
  const attachEl = document.getElementById('hist-attach');
  const listEl = document.getElementById('history-list');
  const formTitleEl = document.getElementById('form-title');
  const submitBtn = document.getElementById('form-submit-btn');
  const cancelBtn = document.getElementById('form-cancel-btn');
  const searchEl = document.getElementById('history-search');
  const filterCategoryEl = document.getElementById('history-filter-category');
  const filterStatusEl = document.getElementById('history-filter-status');

  let filterText = '';
  let filterCategory = '';
  let filterStatus = '';

  function getCategoryLabel(k){
    const map = { research: 'Research', presentation: 'Presentation', paper: 'Paper', patent: 'Patent', other: 'Other' };
    return map[k] || k;
  }

  function readFileAsDataURL(file){
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function renderList(){
    if(!listEl) return; // Not on research page
    const all = await idbGetAll();
    // sort by start date desc
    all.sort((a,b)=> (b.start || b.added) > (a.start || a.added) ? 1 : -1);
    const text = filterText.toLowerCase();
    const filtered = all.filter(item => {
      if(filterCategory && item.category !== filterCategory) return false;
      if(filterStatus && item.status !== filterStatus) return false;
      if(!text) return true;
      const hay = `${item.title || ''} ${item.desc || ''} ${item.researcher || ''} ${item.role || ''}`.toLowerCase();
      return hay.includes(text);
    });

    listEl.innerHTML = '';
    if(filtered.length === 0){ listEl.innerHTML = '<p class="muted">No activities yet</p>'; return; }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      const header = document.createElement('div'); header.className = 'history-card-header';
      const title = document.createElement('h4'); title.textContent = item.title;
      const meta = document.createElement('div'); meta.className = 'history-meta';
      const who = document.createElement('span'); who.className = 'history-who'; who.textContent = item.researcher || '';
      const cat = document.createElement('span'); cat.className = 'history-cat'; cat.textContent = getCategoryLabel(item.category);
      meta.appendChild(who); meta.appendChild(document.createTextNode(' · ')); meta.appendChild(cat);
      header.appendChild(title); header.appendChild(meta);

      const body = document.createElement('div'); body.className = 'history-body';
      const role = document.createElement('p'); role.className = 'history-role'; role.textContent = item.role ? `Role: ${item.role}` : '';
      const range = document.createElement('p'); range.className = 'history-range';
      const start = item.start || '';
      const end = item.ongoing ? 'Ongoing' : (item.end || '');
      range.textContent = start ? (end ? `${start} — ${end}` : start) : '';
      const status = document.createElement('p'); status.className = 'history-status'; status.textContent = `Status: ${item.status || 'ongoing'}`;
      const desc = document.createElement('p'); desc.className = 'history-desc'; desc.textContent = item.desc || '';
      body.appendChild(role); body.appendChild(range); body.appendChild(status); if(item.desc) body.appendChild(desc);

      if(item.attach){
        const aWrap = document.createElement('div'); aWrap.className = 'history-attach';
        const aLink = document.createElement('a'); aLink.href = item.attach; aLink.target = '_blank'; aLink.textContent = 'View attachment (PDF)';
        aWrap.appendChild(aLink); body.appendChild(aWrap);
      }

      const actions = document.createElement('div'); actions.className = 'history-actions';
      const editBtn = document.createElement('button'); editBtn.className = 'btn btn-small'; editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', ()=> editItem(item));
      const delBtn = document.createElement('button'); delBtn.className = 'btn btn-small'; delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async ()=>{ if(confirm('Delete this activity?')){ await idbDelete(item.id); await renderList(); await renderSummary(); } });
      const toggleBtn = document.createElement('button'); toggleBtn.className = 'btn btn-small'; toggleBtn.textContent = item.status === 'completed' ? 'Mark Ongoing' : 'Mark Completed';
      toggleBtn.addEventListener('click', async ()=>{ item.status = item.status === 'completed' ? 'ongoing' : 'completed'; if(item.status === 'completed'){ item.ongoing = false; } await idbPut(item); await renderList(); await renderSummary(); });
      actions.appendChild(editBtn); actions.appendChild(delBtn); actions.appendChild(toggleBtn);

      card.appendChild(header); card.appendChild(body); card.appendChild(actions);
      listEl.appendChild(card);
    });
  }

  // Render summary for homepage (latest 3-5 activities only)
  async function renderSummary(){
    const summaryEl = document.getElementById('history-summary');
    if(!summaryEl) return; // not on homepage

    const all = await idbGetAll();
    all.sort((a,b)=> (b.start || b.added) > (a.start || a.added) ? 1 : -1);
    
    summaryEl.innerHTML = '';
    if(all.length === 0){
      summaryEl.innerHTML = '<p class="muted">No activities yet. <a href="research.html">Add one →</a></p>';
      return;
    }

    const recent = all.slice(0, 4); // Show latest 4 items
    
    recent.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card summary';
      
      const header = document.createElement('div');
      header.className = 'history-card-header';
      
      const title = document.createElement('h4');
      title.textContent = item.title;
      
      const meta = document.createElement('div');
      meta.className = 'history-meta';
      const who = document.createElement('span');
      who.className = 'history-who';
      who.textContent = item.researcher || '';
      const cat = document.createElement('span');
      cat.className = 'history-cat';
      cat.textContent = getCategoryLabel(item.category);
      
      meta.appendChild(who);
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(cat);
      
      header.appendChild(title);
      header.appendChild(meta);

      const body = document.createElement('div');
      body.className = 'history-body';
      
      const range = document.createElement('p');
      range.className = 'history-range';
      const start = item.start || '';
      const end = item.ongoing ? 'Ongoing' : (item.end || '');
      range.textContent = start ? (end ? `${start} — ${end}` : start) : '';
      body.appendChild(range);
      
      if(item.desc){
        const desc = document.createElement('p');
        desc.className = 'history-desc';
        desc.textContent = item.desc;
        body.appendChild(desc);
      }

      card.appendChild(header);
      card.appendChild(body);
      summaryEl.appendChild(card);
    });
  }

  function editItem(item){
    editingId = item.id;
    titleEl.value = item.title || '';
    researcherEl.value = item.researcher || '';
    categoryEl.value = item.category || 'research';
    roleEl.value = item.role || '';
    startEl.value = item.start || '';
    endEl.value = item.end || '';
    ongoingEl.checked = !!item.ongoing;
    statusEl.value = item.status || (item.ongoing ? 'ongoing' : 'completed');
    descEl.value = item.desc || '';
    formTitleEl.textContent = 'Edit Activity'; 
    submitBtn.textContent = 'Update'; 
    cancelBtn.style.display = 'inline-block';
    document.querySelector('div[style*="position: sticky"]').scrollIntoView({behavior:'smooth'});
  }

  function cancelEdit(){ editingId = null; form.reset(); formTitleEl.textContent = 'Add Activity'; submitBtn.textContent = 'Add'; cancelBtn.style.display = 'none'; }

  if(form){
    form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const title = titleEl.value.trim(); if(!title) return alert('Title required');
    const researcher = researcherEl.value.trim();
    const category = categoryEl.value;
    const role = roleEl.value.trim();
    const start = startEl.value;
    const end = endEl.value || null;
    const ongoing = ongoingEl.checked;
    const status = statusEl.value || (ongoing ? 'ongoing' : 'completed');
    const desc = descEl.value.trim();

    let attachData = null;
    if(attachEl.files && attachEl.files.length > 0){
      attachData = await readFileAsDataURL(attachEl.files[0]);
    }

    if(editingId){
      const all = await idbGetAll();
      const item = all.find(i=>i.id===editingId);
      if(item){
        item.title = title; item.researcher = researcher; item.category = category; item.role = role;
        item.start = start; item.end = end; item.ongoing = ongoing; item.status = status; item.desc = desc;
        if(attachData) item.attach = attachData;
        await idbPut(item);
      }
      cancelEdit();
    } else {
      const newItem = { title, researcher, category, role, start, end, ongoing, status, desc, attach: attachData, added: Date.now() };
      await idbPut(newItem);
    }

    form.reset(); attachEl.value = '';
    await renderList();
    await renderSummary();
    });
  }

  if(cancelBtn){
    cancelBtn.addEventListener('click', cancelEdit);
  }

  if(searchEl){
    searchEl.addEventListener('input', ()=>{ filterText = searchEl.value.trim(); renderList(); });
  }
  if(filterCategoryEl){
    filterCategoryEl.addEventListener('change', ()=>{ filterCategory = filterCategoryEl.value; renderList(); });
  }
  if(filterStatusEl){
    filterStatusEl.addEventListener('change', ()=>{ filterStatus = filterStatusEl.value; renderList(); });
  }

  // Initialize sample data if empty
  async function initializeSampleDataIfEmpty(){
    const all = await idbGetAll();
    if(all.length === 0){
      const sampleActivities = [
        {
          title: 'Beam Shaping Using Spatial Light Modulator',
          researcher: 'Kim, NK',
          category: 'research',
          role: 'PI',
          start: '2024-01-15',
          end: '2025-12-15',
          ongoing: true,
          status: 'ongoing',
          desc: 'Research on dynamic beam shaping using spatial light modulators for improved optical efficiency.',
          attach: null,
          added: Date.now()
        },
        {
          title: 'High-Power Fiber Laser Optimization',
          researcher: 'Lee, JS',
          category: 'research',
          role: 'Co-investigator',
          start: '2024-03-01',
          end: '2025-02-28',
          ongoing: false,
          status: 'completed',
          desc: 'Optimization of fiber laser parameters for maximum power conversion efficiency.',
          attach: null,
          added: Date.now()
        },
        {
          title: 'Optical Fiber Amplifiers: Recent Advances',
          researcher: 'Kim, NK',
          category: 'presentation',
          role: 'Presenter',
          start: '2025-06-15',
          end: '2025-06-15',
          ongoing: false,
          status: 'completed',
          desc: 'Conference presentation at SPIE Photonics West 2025.',
          attach: null,
          added: Date.now()
        },
        {
          title: 'Dichroic Mirror Coatings for Multi-wavelength Laser Systems',
          researcher: 'Park, SH',
          category: 'paper',
          role: 'First Author',
          start: '2024-06-01',
          end: '2025-03-01',
          ongoing: false,
          status: 'completed',
          desc: 'Published in Journal of Optical Engineering. Study on novel dichroic mirror coatings.',
          attach: null,
          added: Date.now()
        }
      ];

      for(const activity of sampleActivities){
        await idbPut(activity);
      }
    }
  }

  // init
  (async function init(){
    await openDB();
    await initializeSampleDataIfEmpty();
    await renderList();
    await renderSummary();
  })();

})();
