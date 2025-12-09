/*
  equipment.js — Lab equipment & materials inventory management
  - Stores equipment data in IndexedDB with images
  - Supports search and filtering
  - Add/Edit/Delete equipment
*/

(function(){
  const DB_NAME = 'equipment-db';
  const DB_VERSION = 1;
  let db = null;
  let allEquipment = [];
  let editingId = null;

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains('equipment')) {
          idb.createObjectStore('equipment', {keyPath: 'id', autoIncrement: true});
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(value){
    // Check authentication before writing
    if(!window.labAuth || !window.labAuth.isAuthenticated()){
      alert('로그인이 필요합니다.');
      return Promise.reject('Not authenticated');
    }
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('equipment', 'readwrite');
      const store = tx.objectStore('equipment');
      const r = value.id ? store.put(value) : store.add(value);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  function idbGetAll(){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('equipment', 'readonly');
      const store = tx.objectStore('equipment');
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  function idbDelete(id){
    // Check authentication before writing
    if(!window.labAuth || !window.labAuth.isAuthenticated()){
      alert('로그인이 필요합니다.');
      return Promise.reject('Not authenticated');
    }
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('equipment', 'readwrite');
      const store = tx.objectStore('equipment');
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  // UI elements
  const form = document.getElementById('equipment-form');
  const nameEl = document.getElementById('eq-name');
  const categoryEl = document.getElementById('eq-category');
  const modelEl = document.getElementById('eq-model');
  const serialEl = document.getElementById('eq-serial');
  const dateEl = document.getElementById('eq-date');
  const dateUnknownEl = document.getElementById('eq-date-unknown');
  const quantityEl = document.getElementById('eq-quantity');
  const statusEl = document.getElementById('eq-status');
  const locationEl = document.getElementById('eq-location');
  const notesEl = document.getElementById('eq-notes');
  const imageEl = document.getElementById('eq-image');
  const formTitleEl = document.getElementById('form-title');
  const formSubmitBtn = document.getElementById('form-submit-btn');
  const formCancelBtn = document.getElementById('form-cancel-btn');
  const equipmentListEl = document.getElementById('equipment-list');
  const searchEl = document.getElementById('eq-search');
  const statusFilterEl = document.getElementById('filter-status');

  const categories = ['laser', 'fabrication', 'measurement', 'electronics', 'support', 'material', 'other'];
  const categoryLabels = {
    'laser': 'Laser & Optics',
    'fabrication': 'Fabrication Equipment',
    'measurement': 'Measurement & Testing',
    'electronics': 'Electronics & Control',
    'support': 'Support & Accessories',
    'material': 'Materials & Consumables',
    'other': 'Other'
  };

  function getCategoryColor(category){
    const colors = {
      'laser': '#3b82f6',
      'fabrication': '#ef4444',
      'measurement': '#10b981',
      'electronics': '#f59e0b',
      'support': '#6b7280',
      'material': '#8b5cf6',
      'other': '#9ca3af'
    };
    return colors[category] || '#9ca3af';
  }

  function getStatusBadge(status){
    const badges = {
      'active': { label: 'Active', color: '#10b981' },
      'maintenance': { label: 'Maintenance', color: '#f59e0b' },
      'inactive': { label: 'Inactive', color: '#6b7280' },
      'faulty': { label: 'Faulty', color: '#ef4444' }
    };
    return badges[status] || badges['inactive'];
  }

  async function renderEquipment(filter = {}){
    allEquipment = await idbGetAll();
    let filtered = allEquipment;

    // Search filter
    if(filter.search){
      const q = filter.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.name.toLowerCase().includes(q) || 
        (e.model && e.model.toLowerCase().includes(q)) ||
        (e.serial && e.serial.toLowerCase().includes(q))
      );
    }

    // Status filter
    if(filter.status){
      filtered = filtered.filter(e => e.status === filter.status);
    }

    equipmentListEl.innerHTML = '';

    if(filtered.length === 0){
      equipmentListEl.innerHTML = '<p class="muted">No equipment found</p>';
      return;
    }

    // Group by category
    const grouped = {};
    filtered.forEach(eq => {
      if(!grouped[eq.category]) grouped[eq.category] = [];
      grouped[eq.category].push(eq);
    });

    // Render by category
    categories.forEach(cat => {
      if(grouped[cat] && grouped[cat].length > 0){
        const categoryTitle = document.createElement('h4');
        categoryTitle.className = 'equipment-category-title';
        categoryTitle.style.color = getCategoryColor(cat);
        categoryTitle.textContent = categoryLabels[cat];
        equipmentListEl.appendChild(categoryTitle);

        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'equipment-grid';

        grouped[cat].forEach(eq => {
          const card = document.createElement('div');
          card.className = 'equipment-card';
          card.style.borderLeftColor = getCategoryColor(eq.category);

          // Image or placeholder
          const imageDiv = document.createElement('div');
          imageDiv.className = 'equipment-image';
          if(eq.image){
            const img = document.createElement('img');
            img.src = eq.image;
            img.alt = eq.name;
            imageDiv.appendChild(img);
          } else {
            imageDiv.textContent = '📦';
          }
          card.appendChild(imageDiv);

          // Content
          const content = document.createElement('div');
          content.className = 'equipment-content';

          const title = document.createElement('h5');
          title.textContent = eq.name;
          content.appendChild(title);

          const model = document.createElement('p');
          model.className = 'equipment-model';
          model.textContent = eq.model || 'No specification';
          content.appendChild(model);

          if(eq.serial){
            const serial = document.createElement('p');
            serial.className = 'equipment-serial';
            serial.textContent = `S/N: ${eq.serial}`;
            content.appendChild(serial);
          }

          const meta = document.createElement('div');
          meta.className = 'equipment-meta';

          const quantity = document.createElement('span');
          quantity.className = 'equipment-quantity';
          quantity.textContent = `Qty: ${eq.quantity}`;
          meta.appendChild(quantity);

          const statusBadge = getStatusBadge(eq.status);
          const status = document.createElement('span');
          status.className = 'equipment-status';
          status.textContent = statusBadge.label;
          status.style.backgroundColor = statusBadge.color;
          meta.appendChild(status);

          content.appendChild(meta);

          if(eq.location){
            const location = document.createElement('p');
            location.className = 'equipment-location';
            location.textContent = `📍 ${eq.location}`;
            content.appendChild(location);
          }

          // Acquisition date or unknown
          if(eq.dateUnknown){
            const dateP = document.createElement('p');
            dateP.className = 'equipment-date';
            dateP.textContent = 'Acquired: Unknown';
            content.appendChild(dateP);
          } else if(eq.date){
            const dateP = document.createElement('p');
            dateP.className = 'equipment-date';
            dateP.textContent = `Acquired: ${eq.date}`;
            content.appendChild(dateP);
          }

          if(eq.notes){
            const notes = document.createElement('p');
            notes.className = 'equipment-notes';
            notes.textContent = eq.notes;
            content.appendChild(notes);
          }

          const actions = document.createElement('div');
          actions.className = 'equipment-actions';

          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-small';
          editBtn.textContent = 'Edit';
          editBtn.addEventListener('click', () => editEquipment(eq));

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn btn-small';
          deleteBtn.textContent = 'Delete';
          deleteBtn.addEventListener('click', async () => {
            if(confirm('Delete this equipment?')){
              await idbDelete(eq.id);
              await renderEquipment(filter);
            }
          });

          actions.appendChild(editBtn);
          actions.appendChild(deleteBtn);
          content.appendChild(actions);

          card.appendChild(content);
          categoryContainer.appendChild(card);
        });

        equipmentListEl.appendChild(categoryContainer);
      }
    });
  }

  function editEquipment(eq){
    editingId = eq.id;
    nameEl.value = eq.name;
    categoryEl.value = eq.category;
    modelEl.value = eq.model || '';
    serialEl.value = eq.serial || '';
    quantityEl.value = eq.quantity;
    statusEl.value = eq.status;
    locationEl.value = eq.location || '';
    notesEl.value = eq.notes || '';

    formTitleEl.textContent = 'Edit Equipment';
    formSubmitBtn.textContent = 'Update Equipment';
    formCancelBtn.style.display = 'inline-block';

    document.querySelector('.equipment-form-card').scrollIntoView({behavior: 'smooth'});
  }

  function cancelEdit(){
    editingId = null;
    form.reset();
    imageEl.value = '';
    formTitleEl.textContent = 'Add Equipment';
    formSubmitBtn.textContent = 'Add Equipment';
    formCancelBtn.style.display = 'none';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameEl.value.trim();
    if(!name) return alert('Equipment name is required');

    let imageData = null;
    if(imageEl.files.length > 0){
      imageData = await readFileAsDataURL(imageEl.files[0]);
    }

    if(editingId){
      // Update existing
      const eq = allEquipment.find(e => e.id === editingId);
      if(eq){
        eq.name = name;
        eq.category = categoryEl.value;
        eq.model = modelEl.value;
        eq.serial = serialEl.value;
        eq.quantity = parseInt(quantityEl.value);
        eq.status = statusEl.value;
        eq.location = locationEl.value;
        eq.date = dateUnknownEl.checked ? null : (dateEl.value || null);
        eq.dateUnknown = !!dateUnknownEl.checked;
        eq.notes = notesEl.value;
        if(imageData) eq.image = imageData;
        await idbPut(eq);
      }
      cancelEdit();
    } else {
      // Add new
      const newEq = {
        name, 
        category: categoryEl.value,
        model: modelEl.value,
        serial: serialEl.value,
        date: dateUnknownEl.checked ? null : (dateEl.value || null),
        dateUnknown: !!dateUnknownEl.checked,
        quantity: parseInt(quantityEl.value),
        status: statusEl.value,
        location: locationEl.value,
        notes: notesEl.value,
        image: imageData,
        added: Date.now()
      };
      await idbPut(newEq);
    }

    form.reset();
    imageEl.value = '';
    alert(editingId ? 'Equipment updated!' : 'Equipment added!');
    await renderEquipment();
  });

  formCancelBtn.addEventListener('click', cancelEdit);

  // Search and filter
  searchEl.addEventListener('input', async () => {
    const filter = {
      search: searchEl.value,
      status: statusFilterEl.value || undefined
    };
    await renderEquipment(filter);
  });

  statusFilterEl.addEventListener('change', async () => {
    const filter = {
      search: searchEl.value,
      status: statusFilterEl.value || undefined
    };
    await renderEquipment(filter);
  });

  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Initialize
  (async function init(){
    await openDB();
    await renderEquipment();
  })();

})();
