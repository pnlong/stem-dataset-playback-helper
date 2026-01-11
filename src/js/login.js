// Login page logic
import { verifyWebsitePassword, getPasswords } from './db.js';

// Rate limiting configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const STORAGE_KEY = 'websiteLoginAttempts';

// Get DOM elements
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const lockoutMessage = document.getElementById('lockoutMessage');

// Check if already authenticated
const hasEntered = sessionStorage.getItem('websitePasswordEntered');
if (hasEntered === 'true') {
  // Already logged in, redirect to intended page or home
  const intendedPage = sessionStorage.getItem('intendedPage') || 'song-list.html';
  sessionStorage.removeItem('intendedPage');
  window.location.href = intendedPage;
}

// Check if passwords are set up
(async () => {
  const passwords = await getPasswords();
  if (!passwords) {
    // No passwords set, redirect to welcome
    window.location.href = 'welcome.html';
  }
})();

// Check for lockout on page load
checkLockout();

// Event listeners
loginBtn.addEventListener('click', handleLogin);
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleLogin();
  }
});

/**
 * Get login attempts from localStorage
 */
function getLoginAttempts() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return { count: 0, lockedUntil: null };
  }
  return JSON.parse(data);
}

/**
 * Save login attempts to localStorage
 */
function saveLoginAttempts(count, lockedUntil = null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ count, lockedUntil }));
}

/**
 * Check if currently locked out
 */
function checkLockout() {
  const attempts = getLoginAttempts();

  if (attempts.lockedUntil) {
    const now = Date.now();
    const timeRemaining = attempts.lockedUntil - now;

    if (timeRemaining > 0) {
      // Still locked out
      const minutesRemaining = Math.ceil(timeRemaining / 60000);
      showLockout(minutesRemaining);
      return true;
    } else {
      // Lockout expired, reset attempts
      saveLoginAttempts(0, null);
      return false;
    }
  }

  return false;
}

/**
 * Show lockout message
 */
function showLockout(minutesRemaining) {
  lockoutMessage.className = 'alert alert-error mt-3';
  lockoutMessage.innerHTML = `
    <strong>Too many failed attempts.</strong><br>
    Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.
  `;
  passwordInput.disabled = true;
  loginBtn.disabled = true;
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.className = 'alert alert-error mt-3';
  errorMessage.textContent = message;
  lockoutMessage.className = 'hidden';
}

/**
 * Handle login
 */
async function handleLogin() {
  // Check if locked out
  if (checkLockout()) {
    return;
  }

  const password = passwordInput.value.trim();

  if (!password) {
    showError('Please enter the website password');
    return;
  }

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Verifying...';

    const isValid = await verifyWebsitePassword(password);

    if (isValid) {
      // Success - reset attempts and login
      saveLoginAttempts(0, null);
      sessionStorage.setItem('websitePasswordEntered', 'true');

      // Redirect to intended page or home
      const intendedPage = sessionStorage.getItem('intendedPage') || 'song-list.html';
      sessionStorage.removeItem('intendedPage');
      window.location.href = intendedPage;
    } else {
      // Failed attempt - increment counter
      const attempts = getLoginAttempts();
      const newCount = attempts.count + 1;

      if (newCount >= MAX_ATTEMPTS) {
        // Lock out the user
        const lockedUntil = Date.now() + LOCKOUT_DURATION;
        saveLoginAttempts(newCount, lockedUntil);
        showLockout(Math.ceil(LOCKOUT_DURATION / 60000));
      } else {
        // Show error with remaining attempts
        saveLoginAttempts(newCount, null);
        const remainingAttempts = MAX_ATTEMPTS - newCount;
        showError(`Incorrect password. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`);
        passwordInput.value = '';
        passwordInput.focus();
        loginBtn.disabled = false;
        loginBtn.textContent = 'Continue';
      }
    }
  } catch (error) {
    console.error('Error during login:', error);
    showError('Error verifying password. Please try again.');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Continue';
  }
}
