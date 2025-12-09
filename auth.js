/* auth.js — Global authentication for site access
   - Email whitelist validation
   - SessionStorage token management
   - Applies to all pages
*/

(function(){
  const AUTH_KEY = 'lab-auth-token';
  const AUTH_EMAIL_KEY = 'lab-auth-email';
  const APPROVED_EMAILS_KEY = 'lab-approved-emails';
  const ADMIN_EMAIL = 'knk6103@gmail.com';
  let currentUser = null;

  // Initialize approved emails from localStorage (admin sets these)
  function getApprovedEmails(){
    try {
      const stored = localStorage.getItem(APPROVED_EMAILS_KEY);
      if(!stored){
        // Initialize with admin email on first run
        const defaultEmails = [ADMIN_EMAIL.toLowerCase()];
        localStorage.setItem(APPROVED_EMAILS_KEY, JSON.stringify(defaultEmails));
        return defaultEmails;
      }
      return JSON.parse(stored);
    } catch(_) {
      return [ADMIN_EMAIL.toLowerCase()];
    }
  }

  function setApprovedEmails(emails){
    try {
      localStorage.setItem(APPROVED_EMAILS_KEY, JSON.stringify(emails || []));
    } catch(_) {}
  }

  function isAuthenticated(){
    try {
      const token = sessionStorage.getItem(AUTH_KEY);
      const email = sessionStorage.getItem(AUTH_EMAIL_KEY);
      return token && email;
    } catch(_) {
      return false;
    }
  }

  function getCurrentUser(){
    try {
      const email = sessionStorage.getItem(AUTH_EMAIL_KEY);
      return email || null;
    } catch(_) {
      return null;
    }
  }

  function login(email){
    email = (email || '').trim().toLowerCase();
    if(!email) return false;
    
    const approved = getApprovedEmails();
    if(!approved.includes(email)){
      alert('승인되지 않은 이메일입니다.');
      return false;
    }

    try {
      const token = 'token-' + Date.now();
      sessionStorage.setItem(AUTH_KEY, token);
      sessionStorage.setItem(AUTH_EMAIL_KEY, email);
      currentUser = email;
      updateAuthUI();
      if(typeof updateSettingsNav === 'function') updateSettingsNav();
      return true;
    } catch(_) {
      alert('로그인 저장에 실패했습니다.');
      return false;
    }
  }

  function logout(){
    try {
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_EMAIL_KEY);
      currentUser = null;
      updateAuthUI();
      if(typeof updateSettingsNav === 'function') updateSettingsNav();
    } catch(_) {}
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
          <p>승인된 이메일로 접속해주세요.</p>
          <input type="email" id="auth-email-input" placeholder="your.email@example.com" />
          <button type="button" class="btn primary" id="auth-modal-signin">Sign In</button>
          <button type="button" class="btn" id="auth-modal-close" style="display:none;">Close</button>
        </div>
      `;
      document.body.appendChild(modal);

      const emailInput = modal.querySelector('#auth-email-input');
      const signInBtn = modal.querySelector('#auth-modal-signin');
      signInBtn.addEventListener('click', ()=>{
        if(login(emailInput.value)){
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
      // Remove existing first
      const existing = list.querySelector('.nav-settings-link');
      if(existing && existing.parentNode) existing.parentNode.remove();
      
      const currentEmail = (getCurrentUser() || '').toLowerCase();
      const adminEmail = ADMIN_EMAIL.toLowerCase();
      
      // Only add Settings if exact match with admin email
      if(currentEmail !== adminEmail) return;
      
      const li = document.createElement('li');
      li.className = 'nav-settings-item';
      const a = document.createElement('a');
      a.href = 'settings.html';
      a.className = 'nav-link nav-settings-link';
      a.textContent = 'Settings';
      li.appendChild(a);
      list.appendChild(li); // Add at the end
    });
  }

  // Wire header auth UI
  window.addEventListener('DOMContentLoaded', ()=>{
    currentUser = getCurrentUser();
    updateAuthUI();
    updateSettingsNav();

    const signInBtn = document.getElementById('auth-signin-btn');
    const signOutBtn = document.getElementById('auth-signout-btn');

    if(signInBtn) signInBtn.addEventListener('click', showLoginModal);
    if(signOutBtn) signOutBtn.addEventListener('click', logout);
  });

  // Expose to global
  window.labAuth = {
    isAuthenticated,
    getCurrentUser,
    login,
    logout,
    requireAuth,
    getApprovedEmails,
    setApprovedEmails,
    updateAuthUI,
    isAdminUser
  };
})();
