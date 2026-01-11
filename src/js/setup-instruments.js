// Instrument setup page logic
import { saveInstruments, getPasswords, checkSetupStatus } from './db.js';
import { checkWebsiteAuth } from './auth-check.js';

// Check if passwords are already set
const existingPasswords = await getPasswords();
if (!existingPasswords) {
  // No passwords set, redirect to password setup
  window.location.href = 'passwords-setup.html';
  throw new Error('Redirecting'); // Stop execution
}

// Passwords exist, check if data already exists to prevent accidental re-setup
const status = await checkSetupStatus();
if (status.hasInstruments) {
  // Instruments already exist, redirect to home page to prevent accidental re-setup
  window.location.href = 'song-list.html';
  throw new Error('Redirecting'); // Stop execution
}

// Check authentication (will redirect to login if not authenticated)
checkWebsiteAuth();

let instruments = [];

// Get DOM elements
const instrumentInput = document.getElementById('instrumentInput');
const addBtn = document.getElementById('addBtn');
const instrumentsUl = document.getElementById('instrumentsUl');
const emptyState = document.getElementById('emptyState');
const recordingSteps = document.getElementById('recordingSteps');
const actionButtons = document.getElementById('actionButtons');
const confirmBtn = document.getElementById('confirmBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const messageArea = document.getElementById('messageArea');

// Event listeners
addBtn.addEventListener('click', addInstrument);
instrumentInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addInstrument();
});
confirmBtn.addEventListener('click', handleConfirm);

/**
 * Show a message banner
 */
function showMessage(message, type = 'info') {
  messageArea.innerHTML = `
    <div class="alert alert-${type}">
      ${message}
    </div>
  `;

  // Auto-dismiss after 3 seconds for success messages
  if (type === 'success') {
    setTimeout(() => {
      messageArea.innerHTML = '';
    }, 3000);
  }
}

/**
 * Clear message banner
 */
function clearMessage() {
  messageArea.innerHTML = '';
}

/**
 * Add an instrument to the list
 */
function addInstrument() {
  const name = instrumentInput.value.trim();

  if (!name) {
    showMessage('Please enter an instrument name', 'warning');
    return;
  }

  if (instruments.includes(name)) {
    showMessage('This instrument has already been added', 'warning');
    return;
  }

  instruments.push(name);
  instrumentInput.value = '';
  clearMessage();
  render();
}

/**
 * Remove an instrument from the list
 */
function removeInstrument(index) {
  instruments.splice(index, 1);
  clearMessage();
  render();
}

/**
 * Move an instrument up in the order
 */
function moveUp(index) {
  if (index === 0) return;
  [instruments[index], instruments[index - 1]] = [instruments[index - 1], instruments[index]];
  render();
}

/**
 * Move an instrument down in the order
 */
function moveDown(index) {
  if (index === instruments.length - 1) return;
  [instruments[index], instruments[index + 1]] = [instruments[index + 1], instruments[index]];
  render();
}

/**
 * Render the instrument list
 */
function render() {
  if (instruments.length === 0) {
    instrumentsUl.classList.add('hidden');
    emptyState.classList.remove('hidden');
    actionButtons.classList.add('hidden');
    recordingSteps.innerHTML = '<li class="text-secondary">Add instruments to see the recording order...</li>';
    return;
  }

  instrumentsUl.classList.remove('hidden');
  emptyState.classList.add('hidden');
  actionButtons.classList.remove('hidden');

  // Render list
  instrumentsUl.innerHTML = instruments.map((name, index) => `
    <li class="list-item">
      <span class="list-item-index">${index + 1}.</span>
      <span class="list-item-content">${name}</span>
      <div class="list-item-actions">
        <button
          class="btn btn-outline"
          onclick="window.moveUp(${index})"
          ${index === 0 ? 'disabled' : ''}
          style="padding: 5px 10px;"
        >
          ↑
        </button>
        <button
          class="btn btn-outline"
          onclick="window.moveDown(${index})"
          ${index === instruments.length - 1 ? 'disabled' : ''}
          style="padding: 5px 10px;"
        >
          ↓
        </button>
        <button
          class="btn btn-danger"
          onclick="window.removeInstrument(${index})"
          style="padding: 5px 10px;"
        >
          Remove
        </button>
      </div>
    </li>
  `).join('');

  // Render recording steps
  recordingSteps.innerHTML = instruments.map((name, index) => {
    if (index === 0) {
      return `<li><strong>${name}</strong> records with click track only</li>`;
    } else {
      const previous = instruments.slice(0, index).join(', ');
      return `<li><strong>${name}</strong> records with click track + ${previous}</li>`;
    }
  }).join('');
}

/**
 * Handle confirm button
 */
async function handleConfirm() {
  if (instruments.length === 0) {
    showMessage('Please add at least one instrument', 'warning');
    return;
  }

  try {
    loadingSpinner.classList.remove('hidden');
    actionButtons.classList.add('hidden');
    clearMessage();

    await saveInstruments(instruments);

    // Success - redirect to song list
    window.location.href = 'song-list.html';
  } catch (error) {
    loadingSpinner.classList.add('hidden');
    actionButtons.classList.remove('hidden');
    showMessage('Failed to save instruments: ' + error.message, 'error');
  }
}

// Expose functions to window for onclick handlers
window.removeInstrument = removeInstrument;
window.moveUp = moveUp;
window.moveDown = moveDown;

// Initial render
render();
