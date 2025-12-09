/* admin.js — Admin controls for managing approved emails */

(function(){
  window.addEventListener('DOMContentLoaded', ()=>{
    const emailsEl = document.getElementById('admin-emails');
    const saveBtnEl = document.getElementById('admin-save-emails');

    if(!emailsEl || !saveBtnEl) return;

    // Load current approved emails
    const current = window.labAuth.getApprovedEmails();
    emailsEl.value = current.join('\n');

    saveBtnEl.addEventListener('click', ()=>{
      const lines = emailsEl.value.trim().split('\n').map(l => l.trim().toLowerCase()).filter(l => l);
      window.labAuth.setApprovedEmails(lines);
      alert(`${lines.length}개의 이메일이 저장되었습니다.`);
    });
  });
})();
