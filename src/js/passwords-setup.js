// Passwords setup page logic
import { savePasswords, getPasswords } from './db.js';

// Check if passwords are already set
const existingPasswords = await getPasswords();
if (existingPasswords) {
  // Passwords already exist, redirect to home page
  window.location.href = 'song-list.html';
  throw new Error('Redirecting'); // Stop execution
}

// Get DOM elements
const websitePasswordInput = document.getElementById('websitePassword');
const websitePasswordConfirmInput = document.getElementById('websitePasswordConfirm');
const adminPasswordInput = document.getElementById('adminPassword');
const adminPasswordConfirmInput = document.getElementById('adminPasswordConfirm');
const toggleWebsitePasswordBtn = document.getElementById('toggleWebsitePassword');
const toggleWebsitePasswordConfirmBtn = document.getElementById('toggleWebsitePasswordConfirm');
const toggleAdminPasswordBtn = document.getElementById('toggleAdminPassword');
const toggleAdminPasswordConfirmBtn = document.getElementById('toggleAdminPasswordConfirm');
const saveBtn = document.getElementById('saveBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const messageArea = document.getElementById('messageArea');

// Event listeners
saveBtn.addEventListener('click', handleSave);

// Password visibility: show on mousedown/touchstart, hide on mouseup/mouseleave/touchend
function setupPasswordToggle(button, input) {
  if (!button || !input) {
    console.error('Password toggle button or input not found');
    return;
  }

  const show = (e) => {
    e.preventDefault();
    input.type = 'text';
    // Keep monospace font when showing password
    input.style.fontFamily = "'Courier New', Courier, monospace";
    input.style.letterSpacing = "0.05em";
  };

  const hide = (e) => {
    if (e) e.preventDefault();
    input.type = 'password';
    // Monospace font is already applied via CSS
    input.style.fontFamily = "";
    input.style.letterSpacing = "";
  };

  button.addEventListener('mousedown', show);
  button.addEventListener('mouseup', hide);
  button.addEventListener('mouseleave', hide);
  button.addEventListener('touchstart', show);
  button.addEventListener('touchend', hide);
  button.addEventListener('touchcancel', hide);

  // Prevent button from taking focus
  button.addEventListener('click', (e) => {
    e.preventDefault();
  });
}

setupPasswordToggle(toggleWebsitePasswordBtn, websitePasswordInput);
setupPasswordToggle(toggleWebsitePasswordConfirmBtn, websitePasswordConfirmInput);
setupPasswordToggle(toggleAdminPasswordBtn, adminPasswordInput);
setupPasswordToggle(toggleAdminPasswordConfirmBtn, adminPasswordConfirmInput);

/**
 * Show message
 */
function showMessage(message, type = 'info') {
  messageArea.innerHTML = `
    <div class="alert alert-${type}">
      ${message}
    </div>
  `;
}

/**
 * Handle save button
 */
async function handleSave() {
  const websitePassword = websitePasswordInput.value.trim();
  const websitePasswordConfirm = websitePasswordConfirmInput.value.trim();
  const adminPassword = adminPasswordInput.value.trim();
  const adminPasswordConfirm = adminPasswordConfirmInput.value.trim();

  // Validation
  if (!websitePassword) {
    showMessage('Please enter a website password', 'warning');
    return;
  }

  if (!websitePasswordConfirm) {
    showMessage('Please confirm the website password', 'warning');
    return;
  }

  if (!adminPassword) {
    showMessage('Please enter an admin password', 'warning');
    return;
  }

  if (!adminPasswordConfirm) {
    showMessage('Please confirm the admin password', 'warning');
    return;
  }

  if (websitePassword.length < 4) {
    showMessage('Website password must be at least 4 characters', 'warning');
    return;
  }

  if (adminPassword.length < 4) {
    showMessage('Admin password must be at least 4 characters', 'warning');
    return;
  }

  // Check password confirmations match
  if (websitePassword !== websitePasswordConfirm) {
    showMessage('Website password and confirmation do not match', 'warning');
    return;
  }

  if (adminPassword !== adminPasswordConfirm) {
    showMessage('Admin password and confirmation do not match', 'warning');
    return;
  }

  try {
    saveBtn.disabled = true;
    loadingSpinner.classList.remove('hidden');
    messageArea.innerHTML = '';

    await savePasswords(websitePassword, adminPassword);

    // Store website password in session for current user
    sessionStorage.setItem('websitePasswordEntered', 'true');

    // Redirect immediately
    window.location.href = 'upload-songs.html';
  } catch (error) {
    console.error('Error saving passwords:', error);
    loadingSpinner.classList.add('hidden');
    saveBtn.disabled = false;
    showMessage('Error saving passwords: ' + error.message, 'error');
  }
}
