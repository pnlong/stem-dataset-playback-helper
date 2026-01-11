// Index page logic (Welcome page)
// This page shows information about the tool and redirects to appropriate setup page

const continueBtn = document.getElementById('continueBtn');

continueBtn.addEventListener('click', handleContinue);

function handleContinue() {
  // Always redirect to password setup page
  // That page will check if passwords are already set and redirect to song-list.html if so
  window.location.href = 'passwords-setup.html';
}
