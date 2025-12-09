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
    const all = await idbGetAll();
    // sort by start date desc
    all.sort((a,b)=> (b.start || b.added) > (a.start || a.added) ? 1 : -1);
    listEl.innerHTML = '';
    if(all.length === 0){ 
      listEl.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--light-text);"><div style="font-size:2rem;margin-bottom:12px;">📭</div><p>No activities yet. Create your first activity!</p></div>';
      return; 
    }

    const categoryMap = {
      research: '🔬',
      presentation: '🎤',
      paper: '📄',
      patent: '🏆',
      other: '📌'
    };

    all.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.style.cssText = `border: 1px solid var(--border-color); border-radius: 8px; padding: 18px; background: var(--surface-bg); transition: all 0.3s ease; border-left: 4px solid ${item.status === 'completed' ? '#22c55e' : 'var(--primary-blue)'}; opacity: ${item.status === 'completed' ? '0.85' : '1'};`;
      
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;';
      
      const title = document.createElement('h4');
      title.textContent = item.title;
      title.style.cssText = 'font-size: 1.05rem; font-weight: 600; color: var(--dark-text); margin: 0;';
      
      const badges = document.createElement('div');
      badges.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
      
      // Category badge
      const catBadge = document.createElement('span');
      catBadge.textContent = `${categoryMap[item.category] || '📌'} ${getCategoryLabel(item.category)}`;
      catBadge.style.cssText = 'display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; background: rgba(11, 95, 165, 0.1); color: var(--primary-blue);';
      badges.appendChild(catBadge);
      
      // Status badge
      const statusBadge = document.createElement('span');
      statusBadge.textContent = item.status === 'completed' ? '✓ Completed' : '🔄 Ongoing';
      statusBadge.style.cssText = `display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; background: ${item.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; color: ${item.status === 'completed' ? '#15803d' : '#b45309'};`;
      badges.appendChild(statusBadge);
      
      header.appendChild(title);
      header.appendChild(badges);

      const meta = document.createElement('div');
      meta.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9rem; color: var(--light-text); margin-bottom: 12px;';
      
      if(item.researcher) {
        const researcherItem = document.createElement('div');
        researcherItem.textContent = `👤 ${item.researcher}`;
        meta.appendChild(researcherItem);
      }
      
      if(item.role) {
        const roleItem = document.createElement('div');
        roleItem.textContent = `🎯 Role: ${item.role}`;
        meta.appendChild(roleItem);
      }
      
      if(item.start || item.end) {
        const dateItem = document.createElement('div');
        const startStr = item.start || '?';
        const endStr = item.ongoing ? 'Ongoing' : (item.end || 'TBD');
        dateItem.textContent = `📅 ${startStr} → ${endStr}`;
        meta.appendChild(dateItem);
      }

      const body = document.createElement('div');
      body.style.cssText = 'margin-bottom: 12px;';
      
      if(item.desc) {
        const desc = document.createElement('p');
        desc.textContent = item.desc;
        desc.style.cssText = 'color: var(--medium-text); margin: 0 0 12px 0; line-height: 1.5;';
        body.appendChild(desc);
      }

      if(item.attach){
        const aWrap = document.createElement('div');
        aWrap.style.cssText = 'margin-bottom: 12px;';
        const aLink = document.createElement('a');
        aLink.href = item.attach;
        aLink.target = '_blank';
        aLink.textContent = '📎 View Attachment (PDF)';
        aLink.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; background: rgba(11, 95, 165, 0.1); border-radius: 6px; color: var(--primary-blue); text-decoration: none; font-size: 0.9rem; transition: all 0.2s;';
        aWrap.appendChild(aLink);
        body.appendChild(aWrap);
      }

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 6px; padding-top: 12px; border-top: 1px solid var(--border-color);';
      
      const editBtn = document.createElement('button');
      editBtn.textContent = '✎ Edit';
      editBtn.style.cssText = 'padding: 6px 10px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: #0066cc; transition: all 0.2s;';
      editBtn.addEventListener('click', ()=> editItem(item));
      editBtn.addEventListener('mouseover', (e) => e.target.style.background = 'rgba(0, 102, 204, 0.1)');
      editBtn.addEventListener('mouseout', (e) => e.target.style.background = 'transparent');
      
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑 Delete';
      delBtn.style.cssText = 'padding: 6px 10px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: #dc2626; transition: all 0.2s;';
      delBtn.addEventListener('click', async ()=>{ if(confirm('Delete this activity?')){ await idbDelete(item.id); await renderList(); } });
      delBtn.addEventListener('mouseover', (e) => e.target.style.background = 'rgba(220, 38, 38, 0.1)');
      delBtn.addEventListener('mouseout', (e) => e.target.style.background = 'transparent');
      
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = item.status === 'completed' ? '↩ Mark Ongoing' : '✓ Mark Completed';
      toggleBtn.style.cssText = 'padding: 6px 10px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: var(--primary-blue); transition: all 0.2s;';
      toggleBtn.addEventListener('click', async ()=>{ 
        item.status = item.status === 'completed' ? 'ongoing' : 'completed'; 
        if(item.status === 'completed'){ item.ongoing = false; } 
        await idbPut(item); 
        await renderList(); 
      });
      toggleBtn.addEventListener('mouseover', (e) => e.target.style.background = 'rgba(11, 95, 165, 0.1)');
      toggleBtn.addEventListener('mouseout', (e) => e.target.style.background = 'transparent');
      
      actions.appendChild(editBtn);
      actions.appendChild(toggleBtn);
      actions.appendChild(delBtn);

      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(body);
      card.appendChild(actions);
      listEl.appendChild(card);
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

  function cancelEdit(){ editingId = null; form.reset(); formTitleEl.textContent = 'New Activity'; submitBtn.textContent = 'Add Activity'; cancelBtn.style.display = 'none'; }

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
  });

  cancelBtn.addEventListener('click', cancelEdit);

  // init
  (async function init(){ await openDB(); await renderList(); })();

})();
