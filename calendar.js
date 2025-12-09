/*
  calendar.js — Lab calendar management
  - Stores events in IndexedDB
  - Renders monthly calendar view
  - Allows add/edit/delete events
*/

(function(){
  const DB_NAME = 'calendar-db';
  const DB_VERSION = 1;
  let db = null;
  let currentDate = new Date();
  let selectedDate = null;

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains('events')) {
          idb.createObjectStore('events', {keyPath: 'id', autoIncrement: true});
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(value){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      const r = value.id ? store.put(value) : store.add(value);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  function idbGetAll(){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  function idbDelete(id){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  // UI elements
  const monthYearEl = document.getElementById('month-year');
  const calendarDaysEl = document.getElementById('calendar-days');
  const prevBtn = document.getElementById('prev-month');
  const nextBtn = document.getElementById('next-month');
  const eventForm = document.getElementById('event-form');
  const eventTitleEl = document.getElementById('event-title');
  const eventDateEl = document.getElementById('event-date');
  const eventEndEl = document.getElementById('event-end-date');
  const eventTimeEl = document.getElementById('event-time');
  const eventDescEl = document.getElementById('event-desc');
  const eventColorEl = document.getElementById('event-color');
  const eventRepeatEl = document.getElementById('event-repeat');
  const eventRepeatEndEl = document.getElementById('event-repeat-end');
  const selectedDateDisplayEl = document.getElementById('selected-date-display');
  const eventsListEl = document.getElementById('events-list');
  const formTitleEl = document.getElementById('form-title');
  const formSubmitBtn = document.getElementById('form-submit-btn');
  const formCancelBtn = document.getElementById('form-cancel-btn');
  
  let editingEventId = null;

  function getDaysInMonth(year, month){
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year, month){
    return new Date(year, month, 1).getDay();
  }

  function renderCalendar(){
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    monthYearEl.textContent = currentDate.toLocaleString('en-US', {month: 'long', year: 'numeric'});
    
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    calendarDaysEl.innerHTML = '';
    
    // Empty cells for days before month starts
    for(let i = 0; i < firstDay; i++){
      const cell = document.createElement('div');
      cell.className = 'calendar-day empty';
      calendarDaysEl.appendChild(cell);
    }
    
    // Days of month
    for(let day = 1; day <= daysInMonth; day++){
      const cell = document.createElement('div');
      cell.className = 'calendar-day';
      
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      cell.dataset.date = dateStr;
      
      const dayNum = document.createElement('div');
      dayNum.className = 'day-number';
      dayNum.textContent = day;
      
      cell.appendChild(dayNum);
      cell.addEventListener('click', () => selectDate(dateStr, cell));
      
      // Highlight today
      const today = new Date();
      if(today.getFullYear() === year && today.getMonth() === month && today.getDate() === day){
        cell.classList.add('today');
      }
      
      calendarDaysEl.appendChild(cell);
    }
    
    renderCalendarWithEvents();
  }

  async function selectDate(dateStr, cellEl){
    selectedDate = dateStr;
    
    // Update selected date display
    const dateObj = new Date(dateStr + 'T00:00:00');
    selectedDateDisplayEl.textContent = dateObj.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
    
    // Set date field in form
    eventDateEl.value = dateStr;
    
    // Render events for this date
    await renderEventsForDate(dateStr);
    
    // Update calendar highlighting
    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
    if(cellEl) cellEl.classList.add('selected');
  }

  async function renderEventsForDate(dateStr){
    const allEvents = await idbGetAll();
    const seen = new Set();
    const dayEvents = [];

    function inRange(dateStr, startStr, endStr){
      const d = new Date(dateStr + 'T00:00:00');
      const s = new Date((startStr || dateStr) + 'T00:00:00');
      const e = new Date((endStr || startStr || dateStr) + 'T00:00:00');
      return d >= s && d <= e;
    }

    for(const e of allEvents){
      const s = e.startDate || e.date;
      const en = e.endDate || e.date || s;
      const key = e.groupId || e.id;
      if(inRange(dateStr, s, en) && !seen.has(key)){
        seen.add(key);
        dayEvents.push(e);
      }
    }

    dayEvents.sort((a,b) => (a.time || '23:59').localeCompare(b.time || '23:59'));
    
    eventsListEl.innerHTML = '';
    
    if(dayEvents.length === 0){
      eventsListEl.innerHTML = '<p class="muted">No events</p>';
      return;
    }
    
    dayEvents.forEach(event => {
      const el = document.createElement('div');
      el.className = 'event-item';
      el.style.borderLeftColor = getColorValue(event.color || 'blue');
      
      const titleRow = document.createElement('div');
      titleRow.className = 'event-title-row';
      
      const title = document.createElement('h4');
      title.textContent = event.title;
      
      const importanceBtn = document.createElement('button');
      importanceBtn.className = 'btn-importance';
      importanceBtn.innerHTML = event.important ? '★' : '☆';
      importanceBtn.title = event.important ? 'Remove importance' : 'Mark as important';
      importanceBtn.addEventListener('click', async () => {
        event.important = !event.important;
        await idbPut(event);
        await renderEventsForDate(dateStr);
        renderCalendarWithEvents();
      });
      
      titleRow.appendChild(title);
      titleRow.appendChild(importanceBtn);
      
      const meta = document.createElement('div');
      meta.className = 'event-meta';
      const start = event.startDate || event.date;
      const end = event.endDate || event.date || start;
      const rangeText = start === end ? start : `${start} — ${end}`;
      meta.textContent = event.time ? `${event.time} · ${rangeText}` : rangeText;
      
      const desc = document.createElement('p');
      desc.className = 'event-desc';
      desc.textContent = event.desc || '';
      
      const actions = document.createElement('div');
      actions.className = 'event-actions';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-small';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => editEvent(event));
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-small';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        if(confirm('Delete this event (all occurrences)?')){
          const all = await idbGetAll();
          const gid = event.groupId;
          if(gid){
            for(const it of all){
              if(it.groupId === gid) await idbDelete(it.id);
            }
          } else {
            await idbDelete(event.id);
          }
          await renderEventsForDate(dateStr);
          renderCalendarWithEvents();
        }
      });
      
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      
      el.appendChild(titleRow);
      el.appendChild(meta);
      if(event.desc) el.appendChild(desc);
      el.appendChild(actions);
      
      eventsListEl.appendChild(el);
    });
  }

  async function renderCalendarWithEvents(){
    const allEvents = await idbGetAll();
    function inRange(dateStr, startStr, endStr){
      const d = new Date(dateStr + 'T00:00:00');
      const s = new Date((startStr || dateStr) + 'T00:00:00');
      const e = new Date((endStr || startStr || dateStr) + 'T00:00:00');
      return d >= s && d <= e;
    }
    
    document.querySelectorAll('.calendar-day:not(.empty)').forEach(cell => {
      const dateStr = cell.dataset.date;
      if(!dateStr) return;

      let eventPreview = cell.querySelector('.event-preview');
      if(eventPreview) eventPreview.remove();

      const preview = document.createElement('div');
      preview.className = 'event-preview';

      // collect unique groupIds or ids to avoid duplicates
      const seen = new Set();
      const hits = [];

      for(const event of allEvents){
        const s = event.startDate || event.date;
        const en = event.endDate || event.date || s;
        if(inRange(dateStr, s, en)){
          const key = event.groupId || event.id;
          if(!seen.has(key)){
            seen.add(key);
            hits.push({event, start: s, end: en});
          }
        }
      }

      if(hits.length > 0){
        hits.slice(0,2).forEach(h => {
          const event = h.event;
          const s = h.start;
          const en = h.end;

          const eventTag = document.createElement('div');
          eventTag.className = 'event-tag';
          eventTag.style.backgroundColor = getColorValue(event.color || 'blue');
          eventTag.style.borderLeftColor = getColorValue(event.color || 'blue');

          // determine position
          if(s === en){
            eventTag.classList.add('single-day');
          } else if(dateStr === s){
            eventTag.classList.add('multi','start');
          } else if(dateStr === en){
            eventTag.classList.add('multi','end');
          } else {
            eventTag.classList.add('multi','middle');
          }

          const eventText = document.createElement('span');
          eventText.textContent = (event.important ? '★ ' : '') + event.title;
          eventTag.appendChild(eventText);
          
          // Add click handler to toggle expanded view
          eventTag.addEventListener('click', (e) => {
            e.stopPropagation();
            eventTag.classList.toggle('expanded');
          });
          
          preview.appendChild(eventTag);
        });

        if(hits.length > 2){
          const more = document.createElement('div');
          more.className = 'event-more';
          more.textContent = `+${hits.length - 2} more`;
          preview.appendChild(more);
        }

        cell.appendChild(preview);
      }
    });
  }

  function getColorValue(colorName){
    const colors = {
      'blue': '#0b5fa5',
      'green': '#10b981',
      'red': '#ef4444',
      'yellow': '#f59e0b',
      'purple': '#8b5cf6'
    };
    return colors[colorName] || colors['blue'];
  }

  function editEvent(event){
    editingEventId = event.id;
    eventTitleEl.value = event.title;
    eventDateEl.value = event.startDate || event.date;
    eventEndEl.value = event.endDate || event.date || event.startDate || '';
    eventTimeEl.value = event.time || '';
    eventDescEl.value = event.desc || '';
    eventColorEl.value = event.color || 'blue';
    eventRepeatEl.value = event.repeat || 'none';
    eventRepeatEndEl.value = event.repeatEnd || '';
    
    formTitleEl.textContent = 'Edit Event';
    formSubmitBtn.textContent = 'Update Event';
    formCancelBtn.style.display = 'inline-block';
    
    // Scroll to form
    document.querySelector('.event-form-card').scrollIntoView({behavior: 'smooth'});
  }

  function cancelEdit(){
    editingEventId = null;
    eventForm.reset();
    formTitleEl.textContent = 'Add Event';
    formSubmitBtn.textContent = 'Add Event';
    formCancelBtn.style.display = 'none';
  }

  // Event handlers
  prevBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  nextBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = eventTitleEl.value.trim();
    const startDate = eventDateEl.value;
    const endDate = eventEndEl.value || startDate;
    const time = eventTimeEl.value || '';
    const desc = eventDescEl.value.trim();
    const color = eventColorEl.value;
    const repeat = eventRepeatEl.value;
    const repeatEnd = eventRepeatEndEl.value;
    
    if(!title || !startDate) return alert('Title and start date are required');

    function daysBetween(a,b){
      const da = new Date(a + 'T00:00:00');
      const db = new Date(b + 'T00:00:00');
      return Math.round((db - da) / (1000*60*60*24));
    }

    const duration = Math.max(0, daysBetween(startDate, endDate));

    if(editingEventId){
      // Update existing event - delete old repeating events and create new ones
      const allEvents = await idbGetAll();
      // determine groupId of existing
      const baseEventToDelete = allEvents.find(e => e.id === editingEventId);
      const gid = (baseEventToDelete && baseEventToDelete.groupId) || null;
      const baseImportance = baseEventToDelete ? baseEventToDelete.important : false;
      
      if(gid){
        for(const evt of allEvents){
          if(evt.groupId === gid) await idbDelete(evt.id);
        }
      } else {
        await idbDelete(editingEventId);
      }

      const groupId = gid || ('g-' + Date.now() + '-' + Math.floor(Math.random()*10000));

      // create instances for updated event (single or repeating)
      if(repeat === 'none' || !repeatEnd){
        await idbPut({
          title, startDate, endDate, time, desc, color,
          repeat, repeatEnd: repeatEnd || null,
          important: baseImportance, added: Date.now(), groupId
        });
      } else {
        const s = new Date(startDate);
        const re = new Date(repeatEnd);
        let cur = new Date(s);
        while(cur <= re){
          const sStr = cur.toISOString().split('T')[0];
          const eDate = addDays(cur, duration);
          const eStr = eDate.toISOString().split('T')[0];
          await idbPut({
            title, startDate: sStr, endDate: eStr, time, desc, color,
            repeat, repeatEnd: repeatEnd || null,
            important: baseImportance, added: Date.now(), groupId
          });
          cur = addDays(cur, getRepeatInterval(repeat));
        }
      }

      cancelEdit();
    } else {
      // Add new event(s)
      const groupId = 'g-' + Date.now() + '-' + Math.floor(Math.random()*10000);
      if(repeat === 'none' || !repeatEnd){
        await idbPut({
          title, startDate, endDate, time, desc, color,
          repeat, repeatEnd: repeatEnd || null,
          important: false, added: Date.now(), groupId
        });
      } else {
        const s = new Date(startDate);
        const re = new Date(repeatEnd);
        let cur = new Date(s);
        while(cur <= re){
          const sStr = cur.toISOString().split('T')[0];
          const eDate = addDays(cur, duration);
          const eStr = eDate.toISOString().split('T')[0];
          await idbPut({
            title, startDate: sStr, endDate: eStr, time, desc, color,
            repeat, repeatEnd: repeatEnd || null,
            important: false, added: Date.now(), groupId
          });
          cur = addDays(cur, getRepeatInterval(repeat));
        }
      }
    }
    
    const isUpdate = editingEventId !== null;
    eventForm.reset();
    alert(isUpdate ? 'Event updated!' : 'Event added!');
    
    // Re-render events for selected date
    if(selectedDate) await renderEventsForDate(selectedDate);
    renderCalendar();
  });

  formCancelBtn.addEventListener('click', cancelEdit);

  function addDays(date, days){
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function getRepeatInterval(repeat){
    const intervals = {
      'daily': 1,
      'weekly': 7,
      'biweekly': 14,
      'monthly': 30
    };
    return intervals[repeat] || 0;
  }

  // Initialize sample data if empty
  async function initializeSampleDataIfEmpty(){
    const allEvents = await idbGetAll();
    if(allEvents.length === 0){
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      
      const sampleEvents = [
        {
          title: 'Weekly Lab Meeting',
          startDate: `${year}-${month}-10`,
          endDate: `${year}-${month}-10`,
          time: '14:00',
          desc: 'Regular lab meeting for project discussions',
          color: 'blue',
          repeat: 'weekly',
          repeatEnd: `${year}-12-31`,
          importance: false,
          added: Date.now(),
          groupId: 'g-weekly-' + Date.now()
        },
        {
          title: 'Equipment Maintenance',
          startDate: `${year}-${month}-15`,
          endDate: `${year}-${month}-15`,
          time: '',
          desc: 'Scheduled maintenance for optical equipment',
          color: 'red',
          repeat: 'none',
          repeatEnd: null,
          importance: true,
          added: Date.now(),
          groupId: 'g-maint-' + Date.now()
        },
        {
          title: 'Research Data Analysis',
          startDate: `${year}-${month}-20`,
          endDate: `${year}-${month}-22`,
          time: '',
          desc: 'Analysis of beam shaping experiment results',
          color: 'green',
          repeat: 'none',
          repeatEnd: null,
          importance: true,
          added: Date.now(),
          groupId: 'g-data-' + Date.now()
        }
      ];

      for(const event of sampleEvents){
        await idbPut(event);
      }
    }
  }

  // Initialize
  (async function init(){
    await openDB();
    await initializeSampleDataIfEmpty();
    renderCalendar();
    
    // Select today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const todayCell = document.querySelector('.calendar-day.today');
    await selectDate(todayStr, todayCell);
  })();

})();
