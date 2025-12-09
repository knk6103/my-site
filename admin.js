/* admin.js — Admin controls for managing approved emails */

(function(){
  // Set this to your master passphrase (change it!)
  const MASTER_PASSPHRASE = 'admin123';

  window.addEventListener('DOMContentLoaded', ()=>{
    const emailsEl = document.getElementById('admin-emails');
    const saveBtnEl = document.getElementById('admin-save-emails');

    if(!emailsEl || !saveBtnEl) return;

    let isAdminVerified = false;

    // Check if admin is already verified in this session
    try {
      isAdminVerified = sessionStorage.getItem('admin-verified') === '1';
    } catch(_) {}

    function lockAdmin(){
      emailsEl.disabled = true;
      saveBtnEl.disabled = true;
      emailsEl.placeholder = 'Admin verification required';
    }

    function unlockAdmin(){
      emailsEl.disabled = false;
      saveBtnEl.disabled = false;
      emailsEl.placeholder = 'one@example.com\ntwo@example.com';
    }

    function loadEmails(){
      const current = window.labAuth.getApprovedEmails();
      emailsEl.value = current.join('\n');
    }

    if(!isAdminVerified){
      lockAdmin();
      // Add verify button
      const verifyBtn = document.createElement('button');
      verifyBtn.type = 'button';
      verifyBtn.className = 'btn';
      verifyBtn.textContent = 'Unlock Admin';
      verifyBtn.addEventListener('click', ()=>{
        const pass = prompt('Master Passphrase:');
        if(pass === null) return;
        if(pass === MASTER_PASSPHRASE){
          try { sessionStorage.setItem('admin-verified', '1'); } catch(_) {}
          isAdminVerified = true;
          unlockAdmin();
          loadEmails();
          verifyBtn.style.display = 'none';
        } else {
          alert('패스프레이즈가 올바르지 않습니다.');
        }
      });
      saveBtnEl.parentNode.insertBefore(verifyBtn, saveBtnEl);
    } else {
      unlockAdmin();
      loadEmails();
    }

    saveBtnEl.addEventListener('click', ()=>{
      if(!isAdminVerified) return alert('Admin verification required');
      const lines = emailsEl.value.trim().split('\n').map(l => l.trim().toLowerCase()).filter(l => l);
      window.labAuth.setApprovedEmails(lines);
      alert(`${lines.length}개의 이메일이 저장되었습니다.`);
    });
  });
})();
