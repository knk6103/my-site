/* auth.js — Simple session-based authentication (no email verification)
   - No Supabase Auth required
   - localStorage-based session storage
   - Applies to all pages
*/

(function(){
  const ADMIN_EMAIL = 'knk6103@gmail.com';
  const SESSION_KEY = 'lab_user_email';
  let currentUser = null; // lowercased email

  function isAuthenticated(){
    return !!currentUser;
  }

  function getCurrentUser(){
    return currentUser;
  }

  async function login(email){
    email = (email || '').trim().toLowerCase();
    if(!email){
      alert('이메일을 입력하세요');
      return false;
    }
    if(!email.includes('@')){
      alert('유효한 이메일을 입력하세요');
      return false;
    }
    // Store in localStorage
    try {
      localStorage.setItem(SESSION_KEY, email);
      currentUser = email;
      updateAuthUI();
      updateSettingsNav();
      const main = document.querySelector('main');
      if(main) main.style.display = '';
      alert('로그인되었습니다!');
      return true;
    } catch(err) {
      alert('로그인 실패: ' + err.message);
      return false;
    }
  }

  async function logout(){
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch(_) {}
    currentUser = null;
    updateAuthUI();
    updateSettingsNav();
    const main = document.querySelector('main');
    if(main) main.style.display = 'none';
  }

  function updateAuthUI(){
    const statusEl = document.getElementById('auth-user-status');
    const signInEl = document.getElementById('auth-signin-container');
    const signOutEl = document.getElementById('auth-signout-btn');

    if(isAuthenticated()){
      const user = getCurrentUser();
      if(statusEl) statusEl.textContent = user;
      if(signInEl) signInEl.style.display = 'none';
      if(signOutEl) signOutEl.style.display = 'inline-block';
    } else {
      if(statusEl) statusEl.textContent = '';
      if(signInEl) signInEl.style.display = 'block';
      if(signOutEl) signOutEl.style.display = 'none';
    }
  }

  function isAdminUser(){
    const user = getCurrentUser();
    return user && user.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }

  function requireAuth(){
    if(!isAuthenticated()){
      showLoginModal();
      return false;
    }
    return true;
  }

  function showLoginModal(){
    let modal = document.getElementById('auth-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'auth-modal';
      modal.className = 'auth-modal';
      modal.innerHTML = `
        <div class="auth-modal-content">
          <h2>Lab Access</h2>
          <p>이메일로 로그인해주세요.</p>
          <input type="email" id="auth-email-input" placeholder="your.email@example.com" />
          <button type="button" class="btn primary" id="auth-modal-signin">Sign In</button>
          <button type="button" class="btn" id="auth-modal-close" style="display:none;">Close</button>
        </div>
      `;
      document.body.appendChild(modal);

      const emailInput = modal.querySelector('#auth-email-input');
      const signInBtn = modal.querySelector('#auth-modal-signin');
      signInBtn.addEventListener('click', async ()=>{
        if(await login(emailInput.value)){
          modal.style.display = 'none';
        }
      });
      emailInput.addEventListener('keypress', (e)=>{
        if(e.key === 'Enter') signInBtn.click();
      });
    }
    modal.style.display = 'flex';
  }

  function updateSettingsNav(){
    // Dynamically inject Settings nav only for admin email
    const navLists = document.querySelectorAll('.main-nav ul');
    navLists.forEach(list => {
      const existing = list.querySelector('.nav-settings-link');
      if(existing && existing.parentNode) existing.parentNode.remove();
      const currentEmail = (getCurrentUser() || '').toLowerCase();
      const adminEmail = ADMIN_EMAIL.toLowerCase();
      if(currentEmail !== adminEmail) return;
      const li = document.createElement('li');
      li.className = 'nav-settings-item';
      const a = document.createElement('a');
      a.href = 'settings.html';
      a.className = 'nav-link nav-settings-link';
      a.textContent = 'Settings';
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  async function syncSessionFromSupabase(){
    const { data, error } = await supabase.auth.getSession();
    if(error){
      console.error('getSession error', error);
      return;
    }
    currentSession = data.session;
    currentUser = (data.session?.user?.email || '').toLowerCase() || null;
  }

  async function enforceApproval(){
    console.log('🔒 enforceApproval 시작, currentUser:', currentUser);
    if(!currentUser){
      console.log('❌ 사용자 없음');
      return;
    }
    
    // 먼저 전체 approved_emails 테이블 확인
    const { data: allEmails, error: fetchError } = await supabase.from('approved_emails').select('*');
    console.log('📋 전체 approved_emails 테이블:', allEmails, fetchError);
    
    const ok = await isEmailApproved(currentUser);
    console.log('✅ 승인 여부:', ok);
    
    if(!ok){
      alert('승인되지 않은 이메일입니다.\n현재 이메일: ' + currentUser + '\n승인된 이메일: ' + (allEmails || []).map(e => e.email).join(', '));
      console.log('승인 실패 - 로그아웃 시작');
      await logout();
    } else {
      console.log('승인 성공:', currentUser);
    }
  }

  function wireAuthButtons(){
    const signInBtn = document.getElementById('auth-signin-btn');
    const signOutBtn = document.getElementById('auth-signout-btn');
    if(signInBtn) signInBtn.addEventListener('click', showLoginModal);
    if(signOutBtn) signOutBtn.addEventListener('click', logout);
  }

  // Load session from localStorage IMMEDIATELY (not waiting for DOMContentLoaded)
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if(saved) currentUser = saved;
    console.log('✅ 저장된 세션 로드:', currentUser);
  } catch(_) {}

  // Setup DOMContentLoaded handlers
  window.addEventListener('DOMContentLoaded', ()=>{
    updateAuthUI();
    updateSettingsNav();
    const main = document.querySelector('main');
    if(main) main.style.display = isAuthenticated() ? '' : 'none';
    wireAuthButtons();
  });

  // Expose to global
  window.labAuth = {
    isAuthenticated,
    getCurrentUser,
    login,
    logout,
    requireAuth,
    updateAuthUI,
    updateSettingsNav,
    isAdminUser
  };
})();
