/* auth.js — Global authentication via Supabase
   - Email whitelist validation against Supabase table `approved_emails`
   - Supabase Auth (magic link)
   - Applies to all pages
*/

(function(){
  const ADMIN_EMAIL = 'knk6103@gmail.com';
  const supabase = window.supabaseClient;
  let currentUser = null; // lowercased email
  let currentSession = null;

  if(!supabase){
    console.error('Supabase client missing. Ensure supabase.js is loaded before auth.js');
    return;
  }

  async function fetchApprovedEmails(){
    const { data, error } = await supabase.from('approved_emails').select('email');
    if(error){
      console.error('Failed to fetch approved emails', error);
      return [];
    }
    return (data || []).map(r => (r.email || '').toLowerCase()).filter(Boolean);
  }

  async function setApprovedEmails(emails){
    // UPSERT 방식: 각 이메일을 개별적으로 upsert (삭제 없이)
    const unique = Array.from(new Set((emails || []).map(e => e.toLowerCase()).filter(Boolean)));
    console.log('Setting approved emails to:', unique);
    
    try {
      // 기존 이메일 가져오기
      const { data: existing } = await supabase.from('approved_emails').select('email');
      const existingEmails = (existing || []).map(r => r.email);
      console.log('기존 이메일:', existingEmails);
      
      // 삭제할 이메일 (기존에는 있지만 새 목록에는 없는 것)
      const toDelete = existingEmails.filter(e => !unique.includes(e));
      if(toDelete.length > 0) {
        for(const email of toDelete) {
          await supabase.from('approved_emails').delete().eq('email', email);
        }
        console.log('삭제된 이메일:', toDelete);
      }
      
      // 추가할 이메일 (새 목록에는 있지만 기존에는 없는 것)
      const toAdd = unique.filter(e => !existingEmails.includes(e));
      if(toAdd.length > 0) {
        const { data, error } = await supabase.from('approved_emails').insert(
          toAdd.map(e => ({ email: e }))
        ).select();
        if(error) throw error;
        console.log('추가된 이메일:', data);
      }
      
      console.log('저장 완료!');
    } catch(err) {
      console.error('setApprovedEmails error:', err);
      throw err;
    }
  }

  async function isEmailApproved(email){
    const target = (email || '').toLowerCase();
    console.log('🔍 isEmailApproved 체크:', target);
    if(!target) return false;
    
    const { data, error } = await supabase
      .from('approved_emails')
      .select('email')
      .eq('email', target)
      .limit(1)
      .maybeSingle();
    
    console.log('✅ isEmailApproved 결과:', { email: target, data, error });
    
    if(error && error.code !== 'PGRST116'){ // PGRST116: no rows
      console.error('approve check failed', error);
      return false;
    }
    return !!data;
  }

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
    // Send magic link
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    if(error){
      alert('로그인 요청 실패: ' + error.message);
      return false;
    }
    alert('로그인 링크를 이메일로 전송했습니다. 메일함을 확인해주세요.');
    return true;
  }

  async function logout(){
    await supabase.auth.signOut();
    currentUser = null;
    currentSession = null;
    updateAuthUI();
    updateSettingsNav();
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
          <button type="button" class="btn primary" id="auth-modal-signin">Sign In (Email Link)</button>
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

  // Auth state change listener
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentSession = session;
    currentUser = (session?.user?.email || '').toLowerCase() || null;
    if(currentUser){
      await enforceApproval();
    }
    updateAuthUI();
    updateSettingsNav();
  });

  // Wire header auth UI
  window.addEventListener('DOMContentLoaded', async ()=>{
    await syncSessionFromSupabase();
    if(currentUser){
      await enforceApproval();
    }
    updateAuthUI();
    updateSettingsNav();
    wireAuthButtons();
  });

  // Update auth UI when page becomes visible (switching tabs)
  document.addEventListener('visibilitychange', async ()=>{
    if(!document.hidden){
      await syncSessionFromSupabase();
      updateAuthUI();
      updateSettingsNav();
    }
  });

  // Expose to global
  window.labAuth = {
    isAuthenticated,
    getCurrentUser,
    login,
    logout,
    requireAuth,
    getApprovedEmails: fetchApprovedEmails,
    setApprovedEmails,
    updateAuthUI,
    updateSettingsNav,
    isAdminUser
  };
})();
