/*
  script.js — NK Laser & Optics Laboratory
  - 다크모드, 검색 기능, 부드러운 상호작용 담당
  - 수정 위치: 검색 API 또는 테마 동작을 변경하려면 이 파일을 편집하세요
*/

(function(){
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const resInput = document.getElementById('res-query');
  const searchButtons = document.querySelectorAll('.search-buttons button');

  /* 다크 모드 초기화 및 토글 */
  function initTheme(){
    const saved = localStorage.getItem('lab-theme');
    if(saved){
      root.setAttribute('data-theme', saved);
      if(themeToggle) themeToggle.setAttribute('aria-pressed', saved === 'dark');
    } else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
      root.setAttribute('data-theme','dark');
      if(themeToggle) themeToggle.setAttribute('aria-pressed', 'true');
    }
  }

  function toggleTheme(){
    const cur = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    if(next === 'dark'){
      root.setAttribute('data-theme','dark');
      themeToggle.setAttribute('aria-pressed','true');
    } else {
      root.removeAttribute('data-theme');
      themeToggle.setAttribute('aria-pressed','false');
    }
    localStorage.setItem('lab-theme', next);
  }

  if(themeToggle){
    themeToggle.addEventListener('click', toggleTheme);
  }

  /* 리소스 검색 핸들러 */
  function openResource(platform, query){
    if(!query) return;
    const q = encodeURIComponent(query);
    let url = '';
    switch(platform){
      case 'patents': url = `https://patents.google.com/?q=${q}`; break;
      case 'arxiv': url = `https://arxiv.org/search/?query=${q}&searchtype=all`; break;
      case 'ieee': url = `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${q}`; break;
      case 'scholar':
      default: url = `https://scholar.google.com/scholar?q=${q}`; break;
    }
    window.open(url, '_blank', 'noopener');
  }

  if(searchButtons && resInput){
    searchButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const platform = btn.getAttribute('data-target');
        const q = resInput.value.trim();
        if(!q){
          resInput.focus();
          return;
        }
        openResource(platform, q);
      });
    });
    // 엔터를 누르면 기본적으로 Scholar에서 검색
    resInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        const q = resInput.value.trim();
        if(q) openResource('scholar', q);
      }
    });
  }

  /* 부드러운 스크롤 (네비게이션) */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e){
      const href = this.getAttribute('href');
      if(href === '#') return;
      const target = document.querySelector(href);
      if(target){
        e.preventDefault();
        target.scrollIntoView({behavior: 'smooth'});
      }
    });
  });

  /* IndexedDB 초기화 */
  async function initializeSampleData(){
    // Calendar DB 초기화 (기존 데이터 유지)
    const calendarDB = await new Promise((resolve, reject) => {
      const req = indexedDB.open('calendar-db', 1);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains('events')) idb.createObjectStore('events', {keyPath:'id', autoIncrement:true});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Equipment DB 초기화 (기존 데이터 유지)
    const equipmentDB = await new Promise((resolve, reject) => {
      const req = indexedDB.open('equipment-db', 1);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains('equipment')) idb.createObjectStore('equipment', {keyPath:'id', autoIncrement:true});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Research/History DB 초기화 (기존 데이터 유지)
    const historyDB = await new Promise((resolve, reject) => {
      const req = indexedDB.open('history-db', 1);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if(!idb.objectStoreNames.contains('activities')) idb.createObjectStore('activities', {keyPath:'id', autoIncrement:true});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // 페이지 로드 시 데이터 초기화
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initializeSampleData);
  } else {
    initializeSampleData();
  }

  /* 초기화 */
  initTheme();
})();
