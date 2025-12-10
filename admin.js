/* admin.js — Admin controls for managing approved emails */

(function(){
  // Set this to your master passphrase (change it!)
  const MASTER_PASSPHRASE = 'my-lab-2025';
  const ADMIN_EMAIL = 'knk6103@gmail.com'; // Only this email can manage admins

  window.addEventListener('DOMContentLoaded', async ()=>{
    const adminSection = document.querySelector('.admin-section');
    const currentUser = (window.labAuth.getCurrentUser() || '').toLowerCase();
    
    // 🔍 디버깅: 페이지 로드 시 자동으로 테이블 확인
    console.log('=== Settings 페이지 로드 시작 ===');
    console.log('현재 사용자:', currentUser);
    const { data: tableCheck, error: tableError } = await window.supabaseClient.from('approved_emails').select('*');
    console.log('📋 approved_emails 테이블 내용:', tableCheck, tableError);

    // Hide admin section if not admin email
    if(currentUser !== ADMIN_EMAIL.toLowerCase()){
      if(adminSection) adminSection.style.display = 'none';
      return;
    }

    // Show admin section only for admin email
    if(adminSection) adminSection.style.display = 'block';

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

    async function loadEmails(){
      const current = await window.labAuth.getApprovedEmails();
      emailsEl.value = current.join('\n');
    }

    if(!isAdminVerified){
      lockAdmin();
      // Add verify button
      const verifyBtn = document.createElement('button');
      verifyBtn.type = 'button';
      verifyBtn.className = 'btn';
      verifyBtn.textContent = 'Unlock Admin';
      verifyBtn.addEventListener('click', async ()=>{
        const pass = prompt('Master Passphrase:');
        if(pass === null) return;
        if(pass === MASTER_PASSPHRASE){
          try { sessionStorage.setItem('admin-verified', '1'); } catch(_) {}
          isAdminVerified = true;
          unlockAdmin();
          await loadEmails();
          verifyBtn.style.display = 'none';
        } else {
          alert('패스프레이즈가 올바르지 않습니다.');
        }
      });
      saveBtnEl.parentNode.insertBefore(verifyBtn, saveBtnEl);
    } else {
      unlockAdmin();
      await loadEmails();
    }

    saveBtnEl.addEventListener('click', async ()=>{
      if(!isAdminVerified) return alert('Admin verification required');
      
      const lines = emailsEl.value.trim().split('\n')
        .map(l => l.trim().toLowerCase())
        .filter(l => l && l.includes('@'));
      
      console.log('저장할 이메일:', lines);
      
      if(lines.length === 0){
        alert('최소 1개 이상의 유효한 이메일을 입력하세요.');
        return;
      }
      
      saveBtnEl.disabled = true;
      saveBtnEl.textContent = '저장 중...';
      
      try {
        await window.labAuth.setApprovedEmails(lines);
        alert(`${lines.length}개의 이메일이 저장되었습니다.`);
        await loadEmails(); // 저장 후 다시 로드
        saveBtnEl.textContent = 'Save';
      } catch(err) {
        console.error('Failed to save approved emails', err);
        alert('저장에 실패했습니다. 콘솔을 확인하세요.\n' + err.message);
        saveBtnEl.textContent = 'Save';
      } finally {
        saveBtnEl.disabled = false;
      }
    });

    // Poll approved_emails every 2 seconds (polling 방식)
    if(isAdminVerified){
      setInterval(async () => {
        try {
          if(typeof loadEmails === 'function'){
            const current = await window.labAuth.getApprovedEmails();
            const currentText = current.join('\n');
            // 텍스트가 변경되었으면 갱신
            if(emailsEl.value !== currentText){
              emailsEl.value = currentText;
              console.log('이메일 목록 자동 갱신됨');
            }
          }
        } catch(err) {
          console.error('Failed to load emails in polling', err);
        }
      }, 2000);
    }
  });
})();
