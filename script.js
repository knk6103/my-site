/*
  script.js
  - 수정 위치 안내: 초기 테마 설정, 토글 텍스트, 갤러리 항목 동작을 이 파일에서 변경하세요.
*/

(function(){
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const modal = document.getElementById('img-modal');
  const modalImg = document.getElementById('modal-image');
  const modalCaption = document.getElementById('modal-caption');
  const modalClose = document.getElementById('modal-close');

  // 초기 테마 설정: 로컬 스토리지 우선, 그 다음 시스템 선호
  function initTheme(){
    const saved = localStorage.getItem('site-theme');
    if(saved){
      root.setAttribute('data-theme', saved);
      themeToggle.setAttribute('aria-pressed', saved === 'dark');
    } else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
      root.setAttribute('data-theme','dark');
      themeToggle.setAttribute('aria-pressed', 'true');
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
    localStorage.setItem('site-theme', next);
  }

  themeToggle && themeToggle.addEventListener('click', toggleTheme);

  // 갤러리 모달 동작 (이전 기능 — 지금은 리소스 검색이 메인입니다)
  function openModal(src, alt){
    if(!modal) return;
    modalImg.src = src;
    modalImg.alt = alt || '';
    modalCaption.textContent = alt || '';
    modal.setAttribute('aria-hidden','false');
    modalClose && modalClose.focus();
  }
  function closeModal(){
    if(!modal) return;
    modal.setAttribute('aria-hidden','true');
    modalImg.src = '';
    modalCaption.textContent = '';
  }

  // 리소스 검색 핸들러
  const resInput = document.getElementById('res-query');
  const searchButtons = document.querySelectorAll('.search-actions button');

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

  // 초기화
  initTheme();
})();
