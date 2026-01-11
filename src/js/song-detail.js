// Song detail page logic
import { getSong, getAllInstruments, getStemsBySong, getTakesByInstrument, upsertStem, deleteStem, deleteSong, updateSongBPM, updateSongTimeSignature, getPasswords, uploadWavFile, deleteWavFile, generateTakeName, verifyAdminPassword } from './db.js';
import { checkWebsiteAuth } from './auth-check.js';

// Check if passwords are set - if not, redirect to welcome page
const existingPasswords = await getPasswords();
if (!existingPasswords) {
  // No passwords set, redirect to welcome page
  window.location.href = 'welcome.html';
  throw new Error('Redirecting'); // Stop execution
}

// Check authentication (will redirect to login if not authenticated)
checkWebsiteAuth();
import {
  audioContext,
  loadAudioBuffer,
  createClickTrack,
  createCountIn,
  applyOffsetToBuffer,
  mixBuffers,
  drawWaveformToCanvas,
  drawWaveformWithGridlines,
  resumeAudioContext
} from './audio.js';

// State
let currentSong = null;
let allInstruments = [];
let currentStems = [];
let selectedTakes = {}; // Map of instrument_id -> selected take name for mixer
let currentTakes = []; // Current takes for the selected instrument
let editingInstrument = null;
let editingTake = null; // Current take being edited
let mainMixBuffer = null; // Complete mix for playback (stems + click track + count-in)
let mainStemsOnlyBuffer = null; // Stems only for waveform visualization
let mainClickTrackBuffer = null; // Click track separately for playback
let mainCountInBuffer = null; // Count-in separately for playback
let mainSourceNode = null;
let mainClickTrackSourceNode = null;
let mainClickTrackGainNode = null; // Gain node for muting/unmuting click track
let mainCountInSourceNode = null;
let previewBuffer = null;
let previewSourceNode = null;
let loadedWavBuffer = null;
let currentWavUrl = '';
let uploadedButNotSavedUrl = ''; // Track uploaded files that haven't been saved yet
let currentOffset = 0;
let previousOffset = 0; // Track previous offset to calculate changes
let minDurationSeconds = 30; // Minimum duration in seconds (default 30)
let isPlaying = false;
let isInCountIn = false; // Track if we're currently in count-in phase
let playbackStartTime = 0;
let playbackPausedAt = 0; // Track where we paused
let playbackAnimationFrame = null;

// Preview playback state
let isPreviewPlaying = false;
let previewPlaybackStartTime = 0;
let previewPlaybackPausedAt = 0;
let previewAnimationFrame = null;
let isUpdatingOffset = false; // Flag to prevent double updates
let previewClickTrackBuffer = null; // Store click track separately
let previewClickTrackSource = null; // Source node for click track
let previewClickTrackGainNode = null; // Gain node for muting/unmuting click track

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const songId = parseInt(urlParams.get('song_id'));

// Get DOM elements
const notificationContainer = document.getElementById('notificationContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const songContent = document.getElementById('songContent');
const songTitle = document.getElementById('songTitle');
const bpmDisplay = document.getElementById('bpmDisplay');
const bpmEdit = document.getElementById('bpmEdit');
const bpmValue = document.getElementById('bpmValue');
const editBpmBtn = document.getElementById('editBpmBtn');
const bpmInput = document.getElementById('bpmInput');
const saveBpmBtn = document.getElementById('saveBpmBtn');
const cancelBpmBtn = document.getElementById('cancelBpmBtn');
const bpmSaveStatus = document.getElementById('bpmSaveStatus');
const timeSignatureDisplay = document.getElementById('timeSignatureDisplay');
const timeSignatureEdit = document.getElementById('timeSignatureEdit');
const timeSignatureValue = document.getElementById('timeSignatureValue');
const editTimeSignatureBtn = document.getElementById('editTimeSignatureBtn');
const timeSignatureNumerator = document.getElementById('timeSignatureNumerator');
const timeSignatureDenominator = document.getElementById('timeSignatureDenominator');
const saveTimeSignatureBtn = document.getElementById('saveTimeSignatureBtn');
const cancelTimeSignatureBtn = document.getElementById('cancelTimeSignatureBtn');
const timeSignatureSaveStatus = document.getElementById('timeSignatureSaveStatus');
const clickTrackToggle = document.getElementById('clickTrackToggle');
const countInToggle = document.getElementById('countInToggle');
const mainGridlinesToggle = document.getElementById('mainGridlinesToggle');
const durationMinutes = document.getElementById('durationMinutes');
const durationSeconds = document.getElementById('durationSeconds');
const durationHint = document.getElementById('durationHint');
const stemMixer = document.getElementById('stemMixer');
const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const waveformCanvas = document.getElementById('waveform');
const playbackIndicator = document.getElementById('playbackIndicator');
const playbackStatus = document.getElementById('playbackStatus');
const editStemsBtn = document.getElementById('editStemsBtn');
const deleteSongBtn = document.getElementById('deleteSongBtn');

// Edit Stems Modal elements
const modal = document.getElementById('editStemsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const instrumentListView = document.getElementById('instrumentListView');
const instrumentList = document.getElementById('instrumentList');
const stemEditView = document.getElementById('stemEditView');
const backToInstrumentListBtn = document.getElementById('backToInstrumentListBtn');
const editingInstrumentName = document.getElementById('editingInstrumentName');
const takeNameInput = document.getElementById('takeNameInput');
const wavFileInput = document.getElementById('wavFileInput');
const loadWavBtn = document.getElementById('loadWavBtn');
const uploadProgress = document.getElementById('uploadProgress');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadProgressText = document.getElementById('uploadProgressText');
const wavLoadedSection = document.getElementById('wavLoadedSection');
const editingExistingTakeBanner = document.getElementById('editingExistingTakeBanner');
const wavLoadingSpinner = document.getElementById('wavLoadingSpinner');
const previewClickTrackToggle = document.getElementById('previewClickTrackToggle');
const previewGridlinesToggle = document.getElementById('previewGridlinesToggle');
const previewPlayPauseBtn = document.getElementById('previewPlayPauseBtn');
const previewResetBtn = document.getElementById('previewResetBtn');
const previewWaveformCanvas = document.getElementById('previewWaveform');
const previewPlaybackIndicator = document.getElementById('previewPlaybackIndicator');
const previewPlaybackStatus = document.getElementById('previewPlaybackStatus');
const offsetSlider = document.getElementById('offsetSlider');
const offsetInput = document.getElementById('offsetInput');
const offsetValue = document.getElementById('offsetValue');
const sliderMin = document.getElementById('sliderMin');
const sliderMax = document.getElementById('sliderMax');
const updateRangeBtn = document.getElementById('updateRangeBtn');
const saveStemBtn = document.getElementById('saveStemBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const deleteStemBtn = document.getElementById('deleteStemBtn');

// Delete Song Modal elements
const deleteSongModal = document.getElementById('deleteSongModal');
const closeDeleteSongModal = document.getElementById('closeDeleteSongModal');
const confirmDeleteSongBtn = document.getElementById('confirmDeleteSongBtn');
const cancelDeleteSongBtn = document.getElementById('cancelDeleteSongBtn');
const deleteSongAdminPassword = document.getElementById('deleteSongAdminPassword');
const deleteSongPasswordError = document.getElementById('deleteSongPasswordError');
const deleteSongDetails = document.getElementById('deleteSongDetails');

// Delete Stem Modal elements
const deleteStemModal = document.getElementById('deleteStemModal');
const closeDeleteStemModal = document.getElementById('closeDeleteStemModal');
const confirmDeleteStemBtn = document.getElementById('confirmDeleteStemBtn');
const cancelDeleteStemBtn = document.getElementById('cancelDeleteStemBtn');

// Event listeners
editBpmBtn.addEventListener('click', showBpmEdit);
saveBpmBtn.addEventListener('click', handleSaveBpm);
cancelBpmBtn.addEventListener('click', hideBpmEdit);
editTimeSignatureBtn.addEventListener('click', showTimeSignatureEdit);
saveTimeSignatureBtn.addEventListener('click', handleSaveTimeSignature);
cancelTimeSignatureBtn.addEventListener('click', hideTimeSignatureEdit);
durationMinutes.addEventListener('input', validateDuration);
durationSeconds.addEventListener('input', validateDuration);
clickTrackToggle.addEventListener('change', () => {
  // Click track toggle behavior depends on current state:
  // - During count-in: pause (which resets to 0s)
  // - During main playback: mute/unmute in real-time using gain node
  // - When stopped/paused: do nothing (user must manually reset)
  if (isInCountIn) {
    // Currently in count-in phase, pause (this will reset to 0s automatically)
    console.log('Click track toggled during count-in, pausing');
    handlePlayPause(); // Pause, which sets position to 0 when in count-in
  } else if (isPlaying && mainClickTrackGainNode) {
    // In main playback, mute/unmute the click track
    if (clickTrackToggle.checked) {
      console.log('Unmuting click track');
      mainClickTrackGainNode.gain.setValueAtTime(1, audioContext.currentTime);
    } else {
      console.log('Muting click track');
      mainClickTrackGainNode.gain.setValueAtTime(0, audioContext.currentTime);
    }
  }
  // When stopped/paused, do nothing - user must manually reset to apply change
});
countInToggle.addEventListener('change', () => {
  // Count-in toggle behavior depends on current state:
  // - During count-in: pause (which resets to 0s)
  // - During main playback: do nothing (will apply on next reset)
  // - When stopped/paused: do nothing (user must manually reset)
  if (isInCountIn) {
    // Currently in count-in phase, pause (this will reset to 0s automatically)
    console.log('Count-in toggled off during count-in, pausing');
    handlePlayPause(); // Pause, which sets position to 0 when in count-in
  } else if (isPlaying) {
    // In main playback, don't interrupt
    console.log('Count-in toggled during playback, will apply on next reset');
  }
  // When stopped/paused, do nothing - user must manually reset to apply change
});
mainGridlinesToggle.addEventListener('change', async () => {
  // Gridlines toggle is visual only - redraw waveform without resetting playback
  if (!currentSong) return;

  const includeClickTrack = clickTrackToggle.checked;
  const includeCountIn = countInToggle.checked;

  // Only rebuild mix if not playing (if playing, waveform will be out of date but that's ok)
  if (!isPlaying) {
    // Build mix (returns stems, click track, and count-in separately)
    const mixResult = await buildMix(includeClickTrack, includeCountIn);

    mainStemsOnlyBuffer = mixResult.stemsBuffer;
    mainClickTrackBuffer = mixResult.clickTrackBuffer;
    mainCountInBuffer = mixResult.countInBuffer;
  }

  const totalDuration = mainStemsOnlyBuffer ? mainStemsOnlyBuffer.duration :
                        (mainClickTrackBuffer ? mainClickTrackBuffer.duration : 0);

  // Parse time signature to get beats per bar for gridlines
  const { numerator: beatsPerBar } = parseTimeSignature(currentSong.time_signature || '4/4');

  // Redraw waveform showing ONLY stems (with optional gridlines)
  if (mainStemsOnlyBuffer) {
    if (mainGridlinesToggle.checked) {
      drawWaveformWithGridlines(mainStemsOnlyBuffer, waveformCanvas, currentSong.bpm, beatsPerBar, '#4CAF50');
    } else {
      drawWaveformToCanvas(mainStemsOnlyBuffer, waveformCanvas, '#4CAF50');
    }
  } else {
    // No stems - just clear waveform or draw gridlines on empty canvas
    const ctx = waveformCanvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

    if (mainGridlinesToggle.checked && totalDuration > 0) {
      // Draw gridlines on empty waveform
      drawGridlinesOnly(waveformCanvas, currentSong.bpm, beatsPerBar, totalDuration);
    }
  }

  // Keep the playback indicator where it was
  if (playbackPausedAt > 0 && totalDuration > 0) {
    const progress = playbackPausedAt / totalDuration;
    const displayWidth = waveformCanvas.getBoundingClientRect().width;
    const position = progress * displayWidth;
    playbackIndicator.style.left = `${position}px`;
  }
});
playPauseBtn.addEventListener('click', handlePlayPause);
resetBtn.addEventListener('click', handleReset);
editStemsBtn.addEventListener('click', openModal);
deleteSongBtn.addEventListener('click', handleDeleteSong);
closeModalBtn.addEventListener('click', closeModal);
backToInstrumentListBtn.addEventListener('click', showInstrumentList);
loadWavBtn.addEventListener('click', handleLoadWav);
previewClickTrackToggle.addEventListener('change', () => {
  // Metronome toggle - mute/unmute in real-time during playback
  if (isPreviewPlaying && previewClickTrackGainNode) {
    // In playback, mute/unmute the click track
    if (previewClickTrackToggle.checked) {
      console.log('Preview: Unmuting click track');
      previewClickTrackGainNode.gain.setValueAtTime(1, audioContext.currentTime);
    } else {
      console.log('Preview: Muting click track');
      previewClickTrackGainNode.gain.setValueAtTime(0, audioContext.currentTime);
    }
  }
  // No reset needed - just mute/unmute
});
previewGridlinesToggle.addEventListener('change', () => {
  // Gridlines toggle is visual only - redraw but don't reset playback
  updatePreview();
});
previewPlayPauseBtn.addEventListener('click', handlePreviewPlayPause);
previewResetBtn.addEventListener('click', handlePreviewReset);
offsetSlider.addEventListener('input', handleOffsetSliderChange);
offsetInput.addEventListener('input', handleOffsetInputChange);
updateRangeBtn.addEventListener('click', updateSliderRange);
saveStemBtn.addEventListener('click', handleSaveStem);
cancelEditBtn.addEventListener('click', closeModal);
deleteStemBtn.addEventListener('click', handleDeleteStem);
closeDeleteSongModal.addEventListener('click', hideDeleteSongModal);
cancelDeleteSongBtn.addEventListener('click', hideDeleteSongModal);
confirmDeleteSongBtn.addEventListener('click', confirmDeleteSong);
closeDeleteStemModal.addEventListener('click', hideDeleteStemModal);
cancelDeleteStemBtn.addEventListener('click', hideDeleteStemModal);
confirmDeleteStemBtn.addEventListener('click', confirmDeleteStem);

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
deleteSongModal.addEventListener('click', (e) => {
  if (e.target === deleteSongModal) hideDeleteSongModal();
});
deleteStemModal.addEventListener('click', (e) => {
  if (e.target === deleteStemModal) hideDeleteStemModal();
});

// Initialize page
init();

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `alert alert-${type}`;
  notification.style.marginBottom = '15px';
  notification.innerHTML = message;

  notificationContainer.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

/**
 * Initialize page
 */
async function init() {
  if (songId === null || songId === undefined || isNaN(songId)) {
    showNotification('<strong>Error:</strong> Invalid song ID', 'error');
    setTimeout(() => {
      window.location.href = 'song-list.html';
    }, 2000);
    return;
  }

  try {
    // Load data
    [currentSong, allInstruments, currentStems] = await Promise.all([
      getSong(songId),
      getAllInstruments(),
      getStemsBySong(songId)
    ]);

    if (!currentSong) {
      throw new Error('Song not found');
    }

    // Update UI
    songTitle.textContent = currentSong.title
      ? `${currentSong.song_id}: ${currentSong.title}`
      : `Song ${currentSong.song_id}`;
    bpmValue.textContent = currentSong.bpm;
    bpmInput.value = currentSong.bpm;
    timeSignatureValue.textContent = currentSong.time_signature || '4/4';

    // Parse time signature for the separate numerator/denominator inputs
    const { numerator, denominator } = parseTimeSignature(currentSong.time_signature || '4/4');
    timeSignatureNumerator.value = numerator;
    timeSignatureDenominator.value = denominator;

    renderStemMixer();
    await updateClickTrackDuration();

    // Build initial mix and draw waveform
    await rebuildMixAndWaveform();

    loadingSpinner.classList.add('hidden');
    songContent.classList.remove('hidden');
  } catch (error) {
    console.error('Error loading song:', error);
    loadingSpinner.innerHTML = `
      <div class="alert alert-error">
        <strong>Error loading song:</strong> ${error.message}
      </div>
      <button class="btn btn-primary mt-2" onclick="location.href='song-list.html'">
        Back to Song List
      </button>
    `;
  }
}

/**
 * Update click track duration based on longest stem
 */
async function updateClickTrackDuration() {
  // Calculate longest stem duration
  let maxDuration = 0;

  if (currentStems.length > 0) {
    for (const stem of currentStems) {
      try {
        const url = processUrl(stem.wav_url);
        const buffer = await loadAudioBuffer(url);
        const offsetBuffer = applyOffsetToBuffer(buffer, stem.offset_seconds);
        maxDuration = Math.max(maxDuration, offsetBuffer.duration);
      } catch (error) {
        console.error(`Error loading stem for duration calculation:`, error);
      }
    }
  }

  // Set minimum duration - use longest stem, or default to 30 if no stems
  minDurationSeconds = currentStems.length > 0 ? maxDuration : 30;

  // Set default values to the minimum, handling rounding properly
  const minutes = Math.floor(minDurationSeconds / 60);
  const remainingSeconds = minDurationSeconds % 60;
  const seconds = Math.ceil(remainingSeconds); // Round up to ensure we meet minimum

  durationMinutes.value = minutes;
  durationSeconds.value = seconds;

  // Update hint
  const minMinutes = Math.floor(minDurationSeconds / 60);
  const minSeconds = Math.ceil(minDurationSeconds % 60);
  if (currentStems.length > 0) {
    durationHint.textContent = `Minimum: ${minMinutes}m ${minSeconds}s (longest stem)`;
  } else {
    durationHint.textContent = `Default: 30 seconds (no stems yet)`;
  }
}

/**
 * Validate duration input to ensure it's not less than minimum
 */
async function validateDuration() {
  // Sanitize inputs - only allow digits
  durationMinutes.value = durationMinutes.value.replace(/[^0-9]/g, '');
  durationSeconds.value = durationSeconds.value.replace(/[^0-9]/g, '');

  const minutes = parseInt(durationMinutes.value) || 0;
  const seconds = parseInt(durationSeconds.value) || 0;

  // Enforce maximum values
  if (minutes > 60) {
    durationMinutes.value = 60;
  }
  if (seconds > 59) {
    durationSeconds.value = 59;
  }

  const totalSeconds = (parseInt(durationMinutes.value) || 0) * 60 + (parseInt(durationSeconds.value) || 0);

  if (totalSeconds < minDurationSeconds) {
    // Reset to minimum
    const minMinutes = Math.floor(minDurationSeconds / 60);
    const remainingSeconds = minDurationSeconds % 60;
    let minSeconds = Math.ceil(remainingSeconds);

    // Handle edge case where rounding up gives us 60 seconds
    if (minSeconds === 60) {
      durationMinutes.value = minMinutes + 1;
      durationSeconds.value = 0;
    } else {
      durationMinutes.value = minMinutes;
      durationSeconds.value = minSeconds;
    }
  }

  // Rebuild mix and waveform to show the new duration (including extended silence)
  await rebuildMixAndWaveform();
}

/**
 * Show BPM edit mode
 */
function showBpmEdit() {
  bpmDisplay.classList.add('hidden');
  bpmEdit.classList.remove('hidden');
  bpmInput.value = currentSong.bpm;
  bpmInput.focus();
  bpmSaveStatus.textContent = '';
}

/**
 * Hide BPM edit mode
 */
function hideBpmEdit() {
  bpmEdit.classList.add('hidden');
  bpmDisplay.classList.remove('hidden');
  bpmSaveStatus.textContent = '';
}

/**
 * Handle save BPM
 */
async function handleSaveBpm() {
  // Sanitize and validate input
  const sanitizedValue = bpmInput.value.trim().replace(/[^0-9]/g, '');
  const newBpm = parseInt(sanitizedValue);

  if (isNaN(newBpm) || newBpm <= 0 || newBpm > 300) {
    bpmSaveStatus.textContent = '❌ BPM must be between 1 and 300';
    bpmSaveStatus.style.color = 'var(--danger)';
    bpmInput.value = currentSong.bpm; // Reset to current value
    return;
  }

  bpmInput.value = newBpm; // Update with sanitized value

  try {
    saveBpmBtn.disabled = true;
    bpmSaveStatus.textContent = 'Saving...';
    bpmSaveStatus.style.color = 'var(--text-secondary)';

    await updateSongBPM(songId, newBpm);
    currentSong.bpm = newBpm;

    // Update the display value
    bpmValue.textContent = newBpm;

    bpmSaveStatus.textContent = '✓ Saved successfully';
    bpmSaveStatus.style.color = 'var(--success)';
    saveBpmBtn.disabled = false;

    // Rebuild mix and waveform with new BPM
    await rebuildMixAndWaveform();

    // Hide edit mode after short delay
    setTimeout(() => {
      hideBpmEdit();
    }, 1000);
  } catch (error) {
    console.error('Error saving BPM:', error);
    bpmSaveStatus.textContent = '❌ Error saving BPM: ' + error.message;
    bpmSaveStatus.style.color = 'var(--danger)';
    saveBpmBtn.disabled = false;
  }
}

/**
 * Show time signature edit mode
 */
function showTimeSignatureEdit() {
  timeSignatureDisplay.classList.add('hidden');
  timeSignatureEdit.classList.remove('hidden');

  // Parse current time signature into numerator and denominator
  const { numerator, denominator } = parseTimeSignature(currentSong.time_signature || '4/4');
  timeSignatureNumerator.value = numerator;
  timeSignatureDenominator.value = denominator;

  timeSignatureNumerator.focus();
  timeSignatureSaveStatus.textContent = '';
}

/**
 * Hide time signature edit mode
 */
function hideTimeSignatureEdit() {
  timeSignatureEdit.classList.add('hidden');
  timeSignatureDisplay.classList.remove('hidden');
  timeSignatureSaveStatus.textContent = '';
}

/**
 * Parse time signature string into numerator and denominator
 * @param {string} timeSignature - Time signature string (e.g., "4/4", "3/4", "6/8")
 * @returns {Object} - {numerator: number, denominator: number}
 */
function parseTimeSignature(timeSignature) {
  const parts = timeSignature.split('/');
  if (parts.length !== 2) {
    return { numerator: 4, denominator: 4 }; // Default
  }
  const numerator = parseInt(parts[0]);
  const denominator = parseInt(parts[1]);
  if (isNaN(numerator) || isNaN(denominator) || numerator <= 0 || denominator <= 0) {
    return { numerator: 4, denominator: 4 }; // Default
  }
  return { numerator, denominator };
}

/**
 * Handle save time signature
 */
async function handleSaveTimeSignature() {
  // Get and validate numerator
  const numerator = parseInt(timeSignatureNumerator.value);
  if (isNaN(numerator) || numerator <= 0 || numerator > 32) {
    timeSignatureSaveStatus.textContent = '❌ Numerator must be between 1 and 32';
    timeSignatureSaveStatus.style.color = 'var(--danger)';
    return;
  }

  // Get and validate denominator
  const denominator = parseInt(timeSignatureDenominator.value);
  if (isNaN(denominator) || denominator <= 0 || denominator > 32) {
    timeSignatureSaveStatus.textContent = '❌ Denominator must be between 1 and 32';
    timeSignatureSaveStatus.style.color = 'var(--danger)';
    return;
  }

  // Validate that denominator is a power of 2 (common time signature denominators: 1, 2, 4, 8, 16, 32)
  const validDenominators = [1, 2, 4, 8, 16, 32];
  if (!validDenominators.includes(denominator)) {
    timeSignatureSaveStatus.textContent = '❌ Denominator must be 1, 2, 4, 8, 16, or 32';
    timeSignatureSaveStatus.style.color = 'var(--danger)';
    return;
  }

  const newTimeSignature = `${numerator}/${denominator}`;

  try {
    saveTimeSignatureBtn.disabled = true;
    timeSignatureSaveStatus.textContent = 'Saving...';
    timeSignatureSaveStatus.style.color = 'var(--text-secondary)';

    await updateSongTimeSignature(songId, newTimeSignature);
    currentSong.time_signature = newTimeSignature;

    // Update the display value
    timeSignatureValue.textContent = newTimeSignature;

    timeSignatureSaveStatus.textContent = '✓ Saved successfully';
    timeSignatureSaveStatus.style.color = 'var(--success)';
    saveTimeSignatureBtn.disabled = false;

    // Rebuild mix and waveform with new time signature
    await rebuildMixAndWaveform();

    // Hide edit mode after short delay
    setTimeout(() => {
      hideTimeSignatureEdit();
    }, 1000);
  } catch (error) {
    console.error('Error saving time signature:', error);
    timeSignatureSaveStatus.textContent = '❌ Error saving: ' + error.message;
    timeSignatureSaveStatus.style.color = 'var(--danger)';
    saveTimeSignatureBtn.disabled = false;
  }
}

/**
 * Render stem mixer controls
 */
function renderStemMixer() {
  // Group stems by instrument
  const instrumentGroups = {};
  currentStems.forEach(stem => {
    const instId = stem.instrument_id;
    if (!instrumentGroups[instId]) {
      instrumentGroups[instId] = {
        instrument: stem.instruments,
        takes: []
      };
    }
    instrumentGroups[instId].takes.push(stem);
  });

  if (Object.keys(instrumentGroups).length === 0) {
    stemMixer.innerHTML = '<p class="text-secondary">No stems available yet. Click "Edit Stems" below to add stems.</p>';
    return;
  }

  stemMixer.innerHTML = allInstruments.map((instrument, index) => {
    const instId = instrument.instrument_id;
    const group = instrumentGroups[instId];

    if (!group || group.takes.length === 0) {
      // No takes for this instrument
      return '';
    }

    // Initialize selected take if not set (use first take alphabetically)
    if (!selectedTakes[instId]) {
      selectedTakes[instId] = group.takes[0].take;
    }

    const instrumentName = instrument.instrument_name;
    const takesOptions = group.takes.map(take => {
      const selected = selectedTakes[instId] === take.take ? 'selected' : '';
      return `<option value="${take.take}" ${selected}>${take.take}</option>`;
    }).join('');

    return `
      <div class="slider-container" style="border-bottom: 1px solid var(--border); padding-bottom: 15px;">
        <div class="slider-label">
          <strong>${instrumentName}</strong>
          <span id="volume-${index}">100%</span>
        </div>
        <input
          type="range"
          id="slider-${index}"
          class="volume-slider"
          data-index="${index}"
          data-instrument-id="${instId}"
          min="0"
          max="100"
          value="100"
        />
        <div class="toggle-container" style="margin-top: 5px;">
          <label>
            <div class="toggle">
              <input type="checkbox" id="mute-${index}" class="mute-toggle" data-index="${index}" data-instrument-id="${instId}">
              <span class="toggle-slider"></span>
            </div>
          </label>
          <span>Mute</span>
        </div>
        <div style="margin-top: 10px;">
          <label style="font-size: 0.9rem; color: var(--text-secondary);">Take:</label>
          <select id="take-select-${index}" class="take-select" data-instrument-id="${instId}" style="width: 100%; margin-top: 5px; padding: 8px;">
            ${takesOptions}
          </select>
        </div>
      </div>
    `;
  }).filter(html => html !== '').join('');

  // Add event listeners for volume sliders and mute toggles
  document.querySelectorAll('.volume-slider').forEach(slider => {
    slider.addEventListener('input', handleVolumeChange);
  });

  document.querySelectorAll('.mute-toggle').forEach(toggle => {
    toggle.addEventListener('change', handleMuteChange);
  });

  // Add event listeners for take selectors
  document.querySelectorAll('.take-select').forEach(select => {
    select.addEventListener('change', handleTakeChange);
  });
}

/**
 * Handle volume slider change
 */
async function handleVolumeChange(event) {
  const index = event.target.dataset.index;
  const value = event.target.value;
  document.getElementById(`volume-${index}`).textContent = value + '%';

  // Unmute if slider moved
  const muteToggle = document.getElementById(`mute-${index}`);
  if (muteToggle.checked && value > 0) {
    muteToggle.checked = false;
  }

  // If playing, pause to apply the change
  if (isPlaying) {
    await handlePlayPause(); // This will pause and save position
  }

  // Rebuild mix with new volume settings
  await rebuildMixAndWaveform();
}

/**
 * Handle take selection change
 */
async function handleTakeChange(event) {
  const instrumentId = parseInt(event.target.dataset.instrumentId);
  const newTake = event.target.value;

  // Update selected take
  selectedTakes[instrumentId] = newTake;

  // Rebuild mix and waveform with new take
  await rebuildMixAndWaveform();
}

/**
 * Handle mute toggle change
 */
async function handleMuteChange(event) {
  const index = event.target.dataset.index;
  const slider = document.getElementById(`slider-${index}`);

  if (event.target.checked) {
    slider.value = 0;
    document.getElementById(`volume-${index}`).textContent = '0%';
  }

  // If playing, pause to apply the change
  if (isPlaying) {
    await handlePlayPause(); // This will pause and save position
  }

  // Rebuild mix with new mute settings
  await rebuildMixAndWaveform();
}

/**
 * Rebuild mix and draw waveform
 */
async function rebuildMixAndWaveform() {
  if (!currentSong) return;

  try {
    const includeClickTrack = clickTrackToggle.checked;
    const includeCountIn = countInToggle.checked;

    // Stop current playback if playing
    if (isPlaying) {
      if (mainCountInSourceNode) {
        mainCountInSourceNode.stop();
        mainCountInSourceNode = null;
      }
      if (mainSourceNode) {
        mainSourceNode.stop();
        mainSourceNode = null;
      }
      if (mainClickTrackSourceNode) {
        mainClickTrackSourceNode.stop();
        mainClickTrackSourceNode = null;
      }
      if (mainClickTrackGainNode) {
        mainClickTrackGainNode.disconnect();
        mainClickTrackGainNode = null;
      }
      isPlaying = false;
      isInCountIn = false; // Reset count-in flag
      playPauseBtn.textContent = '▶';
      // Only reset paused position if we were actually playing
      playbackPausedAt = 0;
      playbackIndicator.style.left = '0px';
    }
    // Don't reset playbackPausedAt if we're just paused - we want to keep the position

    // Build mix (returns stems, click track, and count-in separately)
    const mixResult = await buildMix(includeClickTrack, includeCountIn);

    mainStemsOnlyBuffer = mixResult.stemsBuffer;
    mainClickTrackBuffer = mixResult.clickTrackBuffer;
    mainCountInBuffer = mixResult.countInBuffer;
    const totalDuration = mixResult.totalDuration;

    // Parse time signature to get beats per bar for gridlines
    const { numerator: beatsPerBar } = parseTimeSignature(currentSong.time_signature || '4/4');

    // Draw waveform showing ONLY stems (with optional gridlines)
    if (mainStemsOnlyBuffer) {
      if (mainGridlinesToggle.checked) {
        drawWaveformWithGridlines(mainStemsOnlyBuffer, waveformCanvas, currentSong.bpm, beatsPerBar, '#4CAF50');
      } else {
        drawWaveformToCanvas(mainStemsOnlyBuffer, waveformCanvas, '#4CAF50');
      }
    } else {
      // No stems - just clear waveform or draw gridlines on empty canvas
      const ctx = waveformCanvas.getContext('2d');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

      if (mainGridlinesToggle.checked && totalDuration > 0) {
        // Draw gridlines on empty waveform
        drawGridlinesOnly(waveformCanvas, currentSong.bpm, beatsPerBar, totalDuration);
      }
    }

    // Update status
    if (!isPlaying) {
      if (playbackPausedAt > 0) {
        const currentStr = formatTime(playbackPausedAt);
        const totalStr = formatTime(totalDuration);
        playbackStatus.textContent = `${currentStr} / ${totalStr}`;
      } else {
        const totalStr = formatTime(totalDuration);
        playbackStatus.textContent = `0:00 / ${totalStr}`;
      }
    }
  } catch (error) {
    console.error('Error building mix:', error);
    playbackStatus.textContent = 'Error building mix';
  }
}

/**
 * Toggle play/pause
 */
async function handlePlayPause() {
  if (isPlaying) {
    // Pause - calculate where we are and keep indicator in place
    // If we're in count-in, reset to 0 (count-in time doesn't count)
    if (isInCountIn) {
      playbackPausedAt = 0;
      console.log('Paused during count-in, resetting to 0 seconds');
    } else {
      const elapsed = audioContext.currentTime - playbackStartTime;
      playbackPausedAt = elapsed;
      console.log('Paused at:', playbackPausedAt, 'seconds');
    }

    // Stop count-in if playing
    if (mainCountInSourceNode) {
      mainCountInSourceNode.stop();
      mainCountInSourceNode = null;
    }

    // Stop stems if playing
    if (mainSourceNode) {
      mainSourceNode.stop();
      mainSourceNode = null;
    }

    // Stop click track if playing
    if (mainClickTrackSourceNode) {
      mainClickTrackSourceNode.stop();
      mainClickTrackSourceNode = null;
    }
    if (mainClickTrackGainNode) {
      mainClickTrackGainNode.disconnect();
      mainClickTrackGainNode = null;
    }

    // Calculate total duration
    const totalDuration = mainStemsOnlyBuffer ? mainStemsOnlyBuffer.duration :
                          (mainClickTrackBuffer ? mainClickTrackBuffer.duration : 0);

    // Update indicator position one final time before stopping
    if (totalDuration > 0 && !isInCountIn) {
      const progress = playbackPausedAt / totalDuration;
      const displayWidth = waveformCanvas.getBoundingClientRect().width;
      const position = progress * displayWidth;
      playbackIndicator.style.left = `${position}px`;
      console.log('Indicator position:', position, 'px', 'Display width:', displayWidth);
    } else if (isInCountIn) {
      // Keep indicator at 0 if pausing during count-in
      playbackIndicator.style.left = '0px';
    }

    isPlaying = false;

    // Reset indicator color to red when pausing
    playbackIndicator.style.backgroundColor = 'red';
    isInCountIn = false; // Reset count-in flag
    playPauseBtn.textContent = '▶';
    const timeStr = formatTime(playbackPausedAt);
    const totalStr = formatTime(totalDuration);
    playbackStatus.textContent = `${timeStr} / ${totalStr}`;

    // Stop animation after updating position
    if (playbackAnimationFrame) {
      cancelAnimationFrame(playbackAnimationFrame);
      playbackAnimationFrame = null;
    }
  } else {
    // Play or Resume
    await resumeAudioContext();

    try {
      playPauseBtn.disabled = true;

      // If no buffers yet, build them
      if (!mainStemsOnlyBuffer && !mainClickTrackBuffer) {
        playbackStatus.textContent = 'Preparing audio mix...';
        const includeClickTrack = clickTrackToggle.checked;
        const includeCountIn = countInToggle.checked;
        const mixResult = await buildMix(includeClickTrack, includeCountIn);

        mainStemsOnlyBuffer = mixResult.stemsBuffer;
        mainClickTrackBuffer = mixResult.clickTrackBuffer;
        mainCountInBuffer = mixResult.countInBuffer;

        if (!mainStemsOnlyBuffer && !mainClickTrackBuffer) {
          throw new Error('No audio to play');
        }

        await rebuildMixAndWaveform();

        // Calculate total duration
        const totalDuration = mainStemsOnlyBuffer ? mainStemsOnlyBuffer.duration :
                              (mainClickTrackBuffer ? mainClickTrackBuffer.duration : 0);

        // If buffer was rebuilt while paused, check if position is still valid
        if (playbackPausedAt > 0 && playbackPausedAt < totalDuration) {
          console.log('Buffer was rebuilt while paused, attempting to resume from', playbackPausedAt);
        } else if (playbackPausedAt >= totalDuration) {
          console.log('Buffer duration changed, resetting to start');
          playbackPausedAt = 0;
          playbackIndicator.style.left = '0px';
        }
      }

      // Calculate total duration for playback
      const totalDuration = mainStemsOnlyBuffer ? mainStemsOnlyBuffer.duration :
                            (mainClickTrackBuffer ? mainClickTrackBuffer.duration : 0);

      // Play from paused position or from start
      let startOffset = playbackPausedAt || 0;
      console.log('Resuming from:', startOffset, 'seconds (paused at:', playbackPausedAt, ')');
      const remainingDuration = totalDuration - startOffset;

      if (remainingDuration <= 0.1) {
        // At or near the end, restart from beginning
        console.log('At end, resetting to start');
        startOffset = 0;
        playbackPausedAt = 0;
        playbackIndicator.style.left = '0px';
      }

      // Determine if we should play count-in:
      // - Starting from 0s AND count-in is enabled AND count-in buffer exists
      const shouldPlayCountIn = (startOffset === 0) && countInToggle.checked && mainCountInBuffer;

      if (shouldPlayCountIn) {
        // Play count-in first, then start main playback after it completes
        console.log('Playing count-in before main playback');

        const startTime = audioContext.currentTime;
        playbackStartTime = startTime; // Start time is now (count-in doesn't count toward playback time)

        // Play count-in
        mainCountInSourceNode = audioContext.createBufferSource();
        mainCountInSourceNode.buffer = mainCountInBuffer;
        mainCountInSourceNode.connect(audioContext.destination);
        mainCountInSourceNode.start(startTime);
        console.log('Started count-in at', startTime);

        // Set up UI state for count-in
        isPlaying = true;
        isInCountIn = true; // Mark that we're in count-in phase
        playPauseBtn.textContent = '⏸';
        playPauseBtn.disabled = false;
        playbackIndicator.style.left = '0px'; // Keep indicator at 0 during count-in
        playbackIndicator.style.backgroundColor = '#FF9800'; // Orange color during count-in
        playbackStatus.textContent = 'Count-in...';

        // When count-in ends, start the main playback
        mainCountInSourceNode.onended = () => {
          if (!isPlaying) {
            // User paused/reset during count-in
            console.log('Count-in ended but playback was stopped');
            isInCountIn = false; // Reset flag
            return;
          }

          console.log('Count-in ended, starting main playback');
          isInCountIn = false; // Count-in is over, now in main playback

          // Change indicator back to red for main playback
          playbackIndicator.style.backgroundColor = 'red';

          // Now start the main playback
          const mainStartTime = audioContext.currentTime;
          playbackStartTime = mainStartTime; // Reset playback start time to when main audio starts

          // Play stems if available
          if (mainStemsOnlyBuffer) {
            mainSourceNode = audioContext.createBufferSource();
            mainSourceNode.buffer = mainStemsOnlyBuffer;
            mainSourceNode.connect(audioContext.destination);
            mainSourceNode.start(mainStartTime);
            console.log('Started stems playback at', mainStartTime);
          }

          // Play click track separately if available (always start, control with gain)
          if (mainClickTrackBuffer) {
            mainClickTrackSourceNode = audioContext.createBufferSource();
            mainClickTrackSourceNode.buffer = mainClickTrackBuffer;

            // Create gain node for mute/unmute control
            mainClickTrackGainNode = audioContext.createGain();
            mainClickTrackGainNode.gain.setValueAtTime(
              clickTrackToggle.checked ? 1 : 0,
              mainStartTime
            );

            // Connect: source -> gain -> destination
            mainClickTrackSourceNode.connect(mainClickTrackGainNode);
            mainClickTrackGainNode.connect(audioContext.destination);
            mainClickTrackSourceNode.start(mainStartTime);
            console.log('Started click track playback at', mainStartTime, 'with gain:', clickTrackToggle.checked ? 1 : 0);
          }

          // Start playback indicator animation
          animatePlaybackIndicator();

          // Set up onended handler for main playback
          const primarySource = mainSourceNode || mainClickTrackSourceNode;
          if (primarySource) {
            primarySource.onended = () => {
              const elapsed = audioContext.currentTime - playbackStartTime;
              const reachedEnd = elapsed >= (totalDuration - 0.1);

              if (reachedEnd) {
                console.log('Playback naturally ended at', elapsed, 'seconds');

                // Stop all audio sources when primary ends
                if (mainSourceNode && mainSourceNode !== primarySource) {
                  try { mainSourceNode.stop(); } catch (e) { console.log('Source already stopped'); }
                  mainSourceNode = null;
                }
                if (mainClickTrackSourceNode && mainClickTrackSourceNode !== primarySource) {
                  try { mainClickTrackSourceNode.stop(); } catch (e) { console.log('Click track already stopped'); }
                  mainClickTrackSourceNode = null;
                }
                if (mainClickTrackGainNode) {
                  mainClickTrackGainNode.disconnect();
                  mainClickTrackGainNode = null;
                }

                isPlaying = false;
                playPauseBtn.textContent = '▶';
                const totalStr = formatTime(totalDuration);
                playbackStatus.textContent = `${totalStr} / ${totalStr}`;
                const displayWidth = waveformCanvas.getBoundingClientRect().width;
                playbackIndicator.style.left = `${displayWidth}px`;
                playbackPausedAt = totalDuration;
                if (playbackAnimationFrame) {
                  cancelAnimationFrame(playbackAnimationFrame);
                  playbackAnimationFrame = null;
                }
              } else {
                console.log('Audio stopped early at', elapsed, 'seconds (pause/reset)');
              }
            };
          }
        };
      } else {
        // No count-in, play normally
        const startTime = audioContext.currentTime;
        playbackStartTime = startTime - startOffset;
        console.log('playbackStartTime:', playbackStartTime, 'audioContext.currentTime:', startTime, 'startOffset:', startOffset);

        // Play stems if available
        if (mainStemsOnlyBuffer) {
          mainSourceNode = audioContext.createBufferSource();
          mainSourceNode.buffer = mainStemsOnlyBuffer;
          mainSourceNode.connect(audioContext.destination);
          mainSourceNode.start(startTime, startOffset);
          console.log('Started stems playback from', startOffset, 'seconds');
        }

        // Play click track separately if available (always start, control with gain)
        if (mainClickTrackBuffer) {
          mainClickTrackSourceNode = audioContext.createBufferSource();
          mainClickTrackSourceNode.buffer = mainClickTrackBuffer;

          // Create gain node for mute/unmute control
          mainClickTrackGainNode = audioContext.createGain();
          mainClickTrackGainNode.gain.setValueAtTime(
            clickTrackToggle.checked ? 1 : 0,
            startTime
          );

          // Connect: source -> gain -> destination
          mainClickTrackSourceNode.connect(mainClickTrackGainNode);
          mainClickTrackGainNode.connect(audioContext.destination);
          mainClickTrackSourceNode.start(startTime, startOffset);
          console.log('Started click track playback from', startOffset, 'seconds with gain:', clickTrackToggle.checked ? 1 : 0);
        }

        isPlaying = true;
        playPauseBtn.textContent = '⏸';
        playPauseBtn.disabled = false;
        playbackIndicator.style.backgroundColor = 'red'; // Normal playback color
        const totalStr = formatTime(totalDuration);
        playbackStatus.textContent = `0:00 / ${totalStr}`;

        // Start playback indicator animation from current position
        animatePlaybackIndicator();

        // Set up onended handler (use whichever source is playing)
        const primarySource = mainSourceNode || mainClickTrackSourceNode;
        if (primarySource) {
          primarySource.onended = () => {
            const elapsed = audioContext.currentTime - playbackStartTime;
            const reachedEnd = elapsed >= (totalDuration - 0.1);

            if (reachedEnd) {
              console.log('Playback naturally ended at', elapsed, 'seconds');

              // Stop all audio sources when primary ends
              if (mainSourceNode && mainSourceNode !== primarySource) {
                try { mainSourceNode.stop(); } catch (e) { console.log('Source already stopped'); }
                mainSourceNode = null;
              }
              if (mainClickTrackSourceNode && mainClickTrackSourceNode !== primarySource) {
                try { mainClickTrackSourceNode.stop(); } catch (e) { console.log('Click track already stopped'); }
                mainClickTrackSourceNode = null;
              }
              if (mainClickTrackGainNode) {
                mainClickTrackGainNode.disconnect();
                mainClickTrackGainNode = null;
              }

              isPlaying = false;
              playPauseBtn.textContent = '▶';
              const totalStr = formatTime(totalDuration);
              playbackStatus.textContent = `${totalStr} / ${totalStr}`;
              const displayWidth = waveformCanvas.getBoundingClientRect().width;
              playbackIndicator.style.left = `${displayWidth}px`;
              playbackPausedAt = totalDuration;
              if (playbackAnimationFrame) {
                cancelAnimationFrame(playbackAnimationFrame);
                playbackAnimationFrame = null;
              }
            } else {
              console.log('Audio stopped early at', elapsed, 'seconds (pause/reset)');
            }
          };
        }
      }
    } catch (error) {
      console.error('Error playing:', error);
      playbackStatus.textContent = 'Playback error - please try again';
      showNotification(`Playback error: ${error.message}`, 'error');
      isPlaying = false;
      playPauseBtn.textContent = '▶';
      playPauseBtn.disabled = false;
    }
  }
}

/**
 * Format time in MM:SS format
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Draw gridlines on empty waveform canvas
 */
function drawGridlinesOnly(canvas, bpm, beatsPerBar, duration) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Calculate bar duration
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * beatsPerBar;

  // Draw center line
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Draw vertical gridlines for each bar
  ctx.strokeStyle = '#0066cc';
  ctx.lineWidth = 2;

  let barTime = 0;
  let barNumber = 0;
  while (barTime <= duration) {
    const x = Math.round((barTime / duration) * width);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    barNumber++;
    barTime = barNumber * secondsPerBar;
  }
}

/**
 * Animate playback indicator and update time display
 */
function animatePlaybackIndicator() {
  if (!isPlaying) return;

  // Calculate total duration
  const totalDuration = mainStemsOnlyBuffer ? mainStemsOnlyBuffer.duration :
                        (mainClickTrackBuffer ? mainClickTrackBuffer.duration : 0);

  if (totalDuration === 0) return;

  const elapsed = audioContext.currentTime - playbackStartTime;
  const progress = elapsed / totalDuration;
  // Use the actual displayed width, not the canvas internal width
  const displayWidth = waveformCanvas.getBoundingClientRect().width;
  const position = progress * displayWidth;

  playbackIndicator.style.left = `${position}px`;

  // Update status text with current time
  const currentStr = formatTime(elapsed);
  const totalStr = formatTime(totalDuration);
  playbackStatus.textContent = `${currentStr} / ${totalStr}`;

  if (progress < 1) {
    playbackAnimationFrame = requestAnimationFrame(animatePlaybackIndicator);
  }
}

/**
 * Reset playback
 */
function handleReset() {
  if (mainCountInSourceNode) {
    mainCountInSourceNode.stop();
    mainCountInSourceNode = null;
  }
  if (mainSourceNode) {
    mainSourceNode.stop();
    mainSourceNode = null;
  }
  if (mainClickTrackSourceNode) {
    mainClickTrackSourceNode.stop();
    mainClickTrackSourceNode = null;
  }
  if (mainClickTrackGainNode) {
    mainClickTrackGainNode.disconnect();
    mainClickTrackGainNode = null;
  }
  isPlaying = false;
  isInCountIn = false; // Reset count-in flag
  playbackPausedAt = 0; // Reset paused position
  playPauseBtn.textContent = '▶';

  // Calculate total duration
  const totalDuration = mainStemsOnlyBuffer ? mainStemsOnlyBuffer.duration :
                        (mainClickTrackBuffer ? mainClickTrackBuffer.duration : 0);

  if (totalDuration > 0) {
    const totalStr = formatTime(totalDuration);
    playbackStatus.textContent = `0:00 / ${totalStr}`;
  } else {
    playbackStatus.textContent = 'Ready to play';
  }
  playbackIndicator.style.left = '0px'; // Reset indicator to start
  playbackIndicator.style.backgroundColor = 'red'; // Reset to normal color
  if (playbackAnimationFrame) {
    cancelAnimationFrame(playbackAnimationFrame);
    playbackAnimationFrame = null;
  }
}

/**
 * Build the stems and click track separately
 * Returns: { stemsBuffer, clickTrackBuffer, countInBuffer, totalDuration }
 */
async function buildMix(includeClickTrack, includeCountIn) {
  const stemBuffers = [];
  const stemVolumes = [];

  // Parse time signature to get beats per bar
  const { numerator: beatsPerBar } = parseTimeSignature(currentSong.time_signature || '4/4');

  // Calculate total duration
  let maxDuration = 0;

  // Load all stem audio buffers using selected takes
  for (let i = 0; i < allInstruments.length; i++) {
    const instrument = allInstruments[i];
    const selectedTakeName = selectedTakes[instrument.instrument_id];

    if (!selectedTakeName) continue; // No take selected for this instrument

    // Find the selected take
    const stem = currentStems.find(s => s.instrument_id === instrument.instrument_id && s.take === selectedTakeName);
    if (!stem) continue; // Selected take not found

    const slider = document.getElementById(`slider-${i}`);
    const volume = slider ? parseInt(slider.value) / 100 : 1;

    if (volume === 0) continue; // Skip muted stems

    try {
      const buffer = await loadAudioBuffer(stem.wav_url);
      const offsetBuffer = applyOffsetToBuffer(buffer, stem.offset_seconds);

      stemBuffers.push(offsetBuffer);
      stemVolumes.push(volume);

      maxDuration = Math.max(maxDuration, offsetBuffer.duration);
    } catch (error) {
      console.error(`Error loading stem ${instrument.instrument_name}:`, error);
    }
  }

  // Get user-specified duration
  const minutes = parseInt(durationMinutes.value) || 0;
  const seconds = parseInt(durationSeconds.value) || 0;
  const userDuration = minutes * 60 + seconds;

  // Use the maximum of stem duration and user-specified duration
  maxDuration = Math.max(maxDuration, userDuration);

  // Build stems-only buffer (for waveform visualization) - NO count-in prepended
  // Extend to full click track duration (pad with silence if needed)
  let stemsOnlyBuffer = null;
  if (stemBuffers.length > 0) {
    stemsOnlyBuffer = mixBuffers(stemBuffers, stemVolumes, maxDuration);
  } else {
    // No stems - create silent buffer of the specified duration for waveform visualization
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.ceil(maxDuration * sampleRate);
    stemsOnlyBuffer = audioContext.createBuffer(2, numSamples, sampleRate);
    // Buffer is already initialized to silence (zeros)
  }

  // Build click track separately (for playback) - NO count-in included
  let clickTrackBuffer = null;
  if (includeClickTrack) {
    clickTrackBuffer = createClickTrack(currentSong.bpm, maxDuration, beatsPerBar, false); // Count-in is separate
  }

  // Build count-in separately (if enabled)
  const secondsPerBeat = 60 / currentSong.bpm;
  const countInDuration = includeCountIn ? beatsPerBar * secondsPerBeat : 0;
  let countInBuffer = null;
  if (includeCountIn) {
    countInBuffer = createClickTrack(currentSong.bpm, 0, beatsPerBar, true); // Just the count-in
  }

  return {
    stemsBuffer: stemsOnlyBuffer,
    clickTrackBuffer: clickTrackBuffer,
    countInBuffer: countInBuffer,
    totalDuration: maxDuration // Total duration WITHOUT count-in
  };
}

/**
 * Open edit stems modal
 */
function openModal() {
  modal.classList.add('active');
  showInstrumentList();
}

/**
 * Close modal
 */
async function closeModal() {
  modal.classList.remove('active');
  await resetModalState();
}

/**
 * Show instrument list in modal
 */
async function showInstrumentList() {
  instrumentListView.classList.remove('hidden');
  stemEditView.classList.add('hidden');

  // Build instrument cards with embedded takes lists
  let html = '';

  for (const instrument of allInstruments) {
    // Get takes for this instrument
    const takes = currentStems.filter(s => s.instrument_id === instrument.instrument_id);
    const takesCount = takes.length;
    const status = takesCount > 0 ? `${takesCount} take${takesCount !== 1 ? 's' : ''}` : 'No takes yet';
    const statusClass = takesCount > 0 ? 'text-success' : 'text-secondary';

    // Create takes list HTML
    let takesHTML = '';
    if (takes.length > 0) {
      takesHTML = takes.map((take, idx) => {
        // Escape HTML in take name for display
        const escapedTakeName = take.take.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `
        <div class="card take-card" data-instrument-id="${instrument.instrument_id}" data-take-name="${escapedTakeName}" data-take-index="${idx}" style="padding: 10px 15px; cursor: pointer;">
          <div class="flex justify-between items-center">
            <div class="card-title" style="margin: 0; font-size: 0.95rem;">${escapedTakeName}</div>
            <div class="flex gap-1">
              <button class="btn btn-outline edit-take-btn" style="padding: 4px 12px; font-size: 0.85rem;">
                Edit
              </button>
              <button class="btn delete-take-btn" style="padding: 6px 10px; font-size: 1.1rem; background-color: #dc3545; color: white; border: 1px solid #dc3545; min-width: 40px;" title="Delete take">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `;
      }).join('');
    } else {
      takesHTML = '<p class="text-secondary" style="margin: 10px 0;">No takes yet. Click "+ Add New Take" below to create one.</p>';
    }

    html += `
      <div class="card" style="margin-bottom: 15px;">
        <div class="flex justify-between items-center card-clickable" onclick="window.toggleInstrumentTakes(${instrument.instrument_id})" style="cursor: pointer;">
          <div>
            <div class="card-title">${instrument.instrument_name}</div>
            <div class="card-subtitle ${statusClass}">${status}</div>
          </div>
          <div>
            <span id="toggle-icon-${instrument.instrument_id}" style="font-size: 1.5rem; color: var(--primary);">▼</span>
          </div>
        </div>
        <div id="takes-list-${instrument.instrument_id}" class="hidden" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
          ${takesHTML}
          <button class="btn btn-primary mt-2" onclick="window.handleAddNewTake(${instrument.instrument_id})" style="width: 100%; padding: 12px; border: 2px dashed var(--primary);">
            <span style="font-size: 1.2rem;">+</span> Add New Take
          </button>
        </div>
      </div>
    `;
  }

  instrumentList.innerHTML = html;

  // Add event listeners to take cards using event delegation
  instrumentList.querySelectorAll('.take-card').forEach(card => {
    const instrumentId = parseInt(card.dataset.instrumentId);
    const takeName = card.dataset.takeName;

    // Edit button click
    const editBtn = card.querySelector('.edit-take-btn');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.editTake(instrumentId, takeName);
    });

    // Delete button click
    const deleteBtn = card.querySelector('.delete-take-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.deleteTakeFromList(instrumentId, takeName);
    });

    // Card click (anywhere except buttons)
    card.addEventListener('click', () => {
      window.editTake(instrumentId, takeName);
    });
  });
}

/**
 * Delete take from list (shows confirmation modal)
 */
window.deleteTakeFromList = async function(instrumentId, takeName) {
  // Set the editing instrument and take for deletion
  editingInstrument = allInstruments.find(i => i.instrument_id === instrumentId);
  editingTake = takeName;

  // Show the delete stem modal
  await handleDeleteStem();
};

/**
 * Toggle instrument takes list visibility
 */
window.toggleInstrumentTakes = function(instrumentId) {
  const takesList = document.getElementById(`takes-list-${instrumentId}`);
  const toggleIcon = document.getElementById(`toggle-icon-${instrumentId}`);

  if (takesList.classList.contains('hidden')) {
    takesList.classList.remove('hidden');
    toggleIcon.textContent = '▲';
  } else {
    takesList.classList.add('hidden');
    toggleIcon.textContent = '▼';
  }
};

/**
 * Edit a specific take
 */
window.editTake = async function(instrumentId, takeName) {
  editingInstrument = allInstruments.find(i => i.instrument_id === instrumentId);
  const take = currentStems.find(s => s.instrument_id === instrumentId && s.take === takeName);

  if (!take) {
    console.error('Take not found:', instrumentId, takeName);
    return;
  }

  editingTake = takeName;

  instrumentListView.classList.add('hidden');
  stemEditView.classList.remove('hidden');

  editingInstrumentName.textContent = `Edit: ${editingInstrument.instrument_name} - ${takeName}`;

  // Pre-fill take name
  takeNameInput.value = takeName;

  // Show delete button for existing takes
  deleteStemBtn.style.display = 'block';

  // Pre-load existing WAV for preview
  currentWavUrl = take.wav_url;
  currentOffset = take.offset_seconds;
  previousOffset = currentOffset; // Initialize previous offset
  offsetSlider.value = currentOffset;
  offsetInput.value = currentOffset;
  offsetValue.textContent = currentOffset.toFixed(2) + 's';

  // Adjust slider range if offset is outside
  const currentMin = parseFloat(sliderMin.value);
  const currentMax = parseFloat(sliderMax.value);
  if (currentOffset < currentMin) {
    sliderMin.value = currentOffset;
    updateSliderRange();
  }
  if (currentOffset > currentMax) {
    sliderMax.value = currentOffset;
    updateSliderRange();
  }

  // Try to load existing WAV for preview
  try {
    uploadProgressText.textContent = 'Loading existing file...';
    uploadProgress.classList.remove('hidden');
    loadedWavBuffer = await loadAudioBuffer(take.wav_url);
    uploadProgress.classList.add('hidden');
    wavLoadedSection.classList.remove('hidden');
    // Show the info banner since we're editing an existing take that was previously uploaded
    editingExistingTakeBanner.classList.remove('hidden');
    updatePreview();
  } catch (error) {
    uploadProgress.classList.add('hidden');
    console.error('Error loading existing WAV:', error);
    showNotification('Could not load existing file for preview. Upload a new file to continue.', 'warning');
  }
};

/**
 * Handle add new take button
 */
window.handleAddNewTake = async function(instrumentId) {
  editingInstrument = allInstruments.find(i => i.instrument_id === instrumentId);

  // Generate a new take name with timestamp
  const newTakeName = generateTakeName();
  editingTake = newTakeName;

  instrumentListView.classList.add('hidden');
  stemEditView.classList.remove('hidden');

  editingInstrumentName.textContent = `Add New Take: ${editingInstrument.instrument_name}`;

  // Pre-fill take name with generated timestamp
  takeNameInput.value = newTakeName;

  // Hide delete button for new takes
  deleteStemBtn.style.display = 'none';

  // Reset the form
  await resetModalState();
};

/**
 * Handle load WAV button - upload file to Supabase Storage
 */
async function handleLoadWav() {
  const file = wavFileInput.files[0];

  if (!file) {
    showNotification('Please select a WAV file', 'warning');
    return;
  }

  // Validate file type
  if (!file.name.toLowerCase().endsWith('.wav') && !file.type.includes('wav')) {
    showNotification('Please select a valid WAV file', 'warning');
    return;
  }

  try {
    loadWavBtn.disabled = true;

    // Show progress bar and set initial state
    uploadProgressBar.style.transition = 'none';
    uploadProgressBar.style.width = '0%';
    uploadProgress.classList.remove('hidden');
    uploadProgressText.textContent = 'Uploading file to storage...';

    // Force reflow to ensure width is set to 0 before animating
    uploadProgressBar.offsetHeight;

    // Enable transition and animate to 30%
    uploadProgressBar.style.transition = 'width 0.3s ease';
    await new Promise(resolve => requestAnimationFrame(resolve));
    uploadProgressBar.style.width = '30%';

    // Get the take name from the input (user can edit it)
    const takeName = takeNameInput.value.trim() || editingTake;

    // Upload file to Supabase Storage
    currentWavUrl = await uploadWavFile(file, songId, editingInstrument.instrument_id, takeName);

    // Track this URL as uploaded but not saved yet
    uploadedButNotSavedUrl = currentWavUrl;

    uploadProgressText.textContent = 'Loading audio for preview...';
    await new Promise(resolve => requestAnimationFrame(resolve));
    uploadProgressBar.style.width = '60%';

    // Load audio from uploaded URL for preview
    loadedWavBuffer = await loadAudioBuffer(currentWavUrl);

    await new Promise(resolve => requestAnimationFrame(resolve));
    uploadProgressBar.style.width = '100%';
    uploadProgressText.textContent = 'Complete!';

    // Hide progress and show loaded section after brief delay
    setTimeout(() => {
      uploadProgress.classList.add('hidden');
      uploadProgressBar.style.transition = 'none';
      uploadProgressBar.style.width = '0%';
      wavLoadedSection.classList.remove('hidden');

      // Reset preview playback position when loading new file
      previewPlaybackPausedAt = 0;
      previewPlaybackIndicator.style.left = '0px';

      // Draw preview waveform
      updatePreview();
    }, 500);

  } catch (error) {
    uploadProgress.classList.add('hidden');
    uploadProgressBar.style.transition = 'none';
    uploadProgressBar.style.width = '0%';
    loadWavBtn.disabled = false;

    let errorMessage = `<strong>Error uploading audio file:</strong> ${error.message}<br><br>`;

    // Check for RLS policy errors
    if (error.message.includes('row-level security') || error.message.includes('policy')) {
      errorMessage += `<strong>⚠️ Missing Storage Policies:</strong><br>
        You need to set up Row Level Security policies for the storage bucket.<br><br>
        <strong>Fix this:</strong><br>
        1. Go to Supabase Dashboard → SQL Editor<br>
        2. Run the storage policies SQL from the README<br>
        3. The policies allow upload/download operations<br>
        4. Try uploading again after running the SQL`;
    } else if (error.message.includes('storage') || error.message.includes('bucket')) {
      errorMessage += `<strong>⚠️ Storage Configuration Issue:</strong><br>
        Make sure your Supabase Storage bucket "wav-files" is created and properly configured.<br><br>
        <strong>Setup steps:</strong><br>
        1. Go to Supabase Dashboard → Storage<br>
        2. Create a new bucket named "wav-files"<br>
        3. Set it to public and enable MIME type restrictions<br>
        4. Run the storage policies SQL (see README)<br>
        5. Try uploading again`;
    } else {
      errorMessage += 'Make sure the file is a valid WAV file.';
    }

    showNotification(errorMessage, 'error');
  }
}

/**
 * Update preview with current offset
 */
function updatePreview() {
  if (!loadedWavBuffer) return;

  // Parse time signature to get beats per bar
  const { numerator: beatsPerBar } = parseTimeSignature(currentSong.time_signature || '4/4');

  console.log('Preview - BPM:', currentSong.bpm, 'Time Sig:', currentSong.time_signature, 'Beats per bar:', beatsPerBar);

  const offsetBuffer = applyOffsetToBuffer(loadedWavBuffer, currentOffset);
  console.log('Preview - offsetBuffer duration:', offsetBuffer.duration);

  // Store the audio buffer WITHOUT mixing in the click track
  previewBuffer = offsetBuffer;

  // Create and store click track separately (for playback, not waveform visualization)
  previewClickTrackBuffer = createClickTrack(currentSong.bpm, offsetBuffer.duration, beatsPerBar);
  console.log('Preview - clickTrack duration:', previewClickTrackBuffer.duration);

  // Calculate expected bar duration for debugging
  const secondsPerBeat = 60 / currentSong.bpm;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  console.log('Preview - Seconds per beat:', secondsPerBeat, 'Seconds per bar:', secondsPerBar);

  // Draw waveform with or without gridlines based on toggle (waveform shows ONLY the stem, not the click track)
  if (previewGridlinesToggle.checked) {
    drawWaveformWithGridlines(previewBuffer, previewWaveformCanvas, currentSong.bpm, beatsPerBar, '#FF9800');
  } else {
    drawWaveformToCanvas(previewBuffer, previewWaveformCanvas, '#FF9800');
  }

  // Update status if not playing
  if (!isPreviewPlaying) {
    const totalStr = formatTime(previewBuffer.duration);
    if (previewPlaybackPausedAt > 0) {
      const currentStr = formatTime(previewPlaybackPausedAt);
      previewPlaybackStatus.textContent = `${currentStr} / ${totalStr}`;
    } else {
      previewPlaybackStatus.textContent = `0:00 / ${totalStr}`;
    }
  }
}

/**
 * Toggle preview play/pause
 */
async function handlePreviewPlayPause() {
  if (isPreviewPlaying) {
    // Pause - calculate where we are and keep indicator in place
    if (previewSourceNode) {
      const elapsed = audioContext.currentTime - previewPlaybackStartTime;
      previewPlaybackPausedAt = elapsed;
      console.log('Preview paused at:', previewPlaybackPausedAt, 'seconds');

      // Update indicator position one final time before stopping
      if (previewBuffer) {
        const progress = elapsed / previewBuffer.duration;
        const displayWidth = previewWaveformCanvas.getBoundingClientRect().width;
        const position = progress * displayWidth;
        previewPlaybackIndicator.style.left = `${position}px`;
      }

      previewSourceNode.stop();
      previewSourceNode = null;
    }

    // Stop click track if playing
    if (previewClickTrackSource) {
      previewClickTrackSource.stop();
      previewClickTrackSource = null;
    }
    if (previewClickTrackGainNode) {
      previewClickTrackGainNode.disconnect();
      previewClickTrackGainNode = null;
    }

    isPreviewPlaying = false;
    previewPlayPauseBtn.textContent = '▶';
    const timeStr = formatTime(previewPlaybackPausedAt);
    const totalStr = formatTime(previewBuffer.duration);
    previewPlaybackStatus.textContent = `${timeStr} / ${totalStr}`;

    // Stop animation after updating position
    if (previewAnimationFrame) {
      cancelAnimationFrame(previewAnimationFrame);
      previewAnimationFrame = null;
    }
  } else {
    // Play or Resume
    await resumeAudioContext();

    if (!previewBuffer) return;

    try {
      previewPlayPauseBtn.disabled = true;

      // Play from paused position or from start
      let startOffset = previewPlaybackPausedAt || 0;
      console.log('Preview resuming from:', startOffset, 'seconds');
      const remainingDuration = previewBuffer.duration - startOffset;

      if (remainingDuration <= 0.1) {
        // At or near the end, restart from beginning
        console.log('Preview at end, resetting to start');
        startOffset = 0;
        previewPlaybackPausedAt = 0;
        previewPlaybackIndicator.style.left = '0px';
      }

      // Schedule playback to start immediately with precise timing
      const startTime = audioContext.currentTime;
      previewPlaybackStartTime = startTime - startOffset;

      // Play the stem audio
      previewSourceNode = audioContext.createBufferSource();
      previewSourceNode.buffer = previewBuffer;
      previewSourceNode.connect(audioContext.destination);
      previewSourceNode.start(startTime, startOffset);

      // Play the click track separately (always start, control with gain)
      if (previewClickTrackBuffer) {
        previewClickTrackSource = audioContext.createBufferSource();
        previewClickTrackSource.buffer = previewClickTrackBuffer;

        // Create gain node for mute/unmute control
        previewClickTrackGainNode = audioContext.createGain();
        previewClickTrackGainNode.gain.setValueAtTime(
          previewClickTrackToggle.checked ? 1 : 0,
          startTime
        );

        // Connect: source -> gain -> destination
        previewClickTrackSource.connect(previewClickTrackGainNode);
        previewClickTrackGainNode.connect(audioContext.destination);
        previewClickTrackSource.start(startTime, startOffset);
        console.log('Preview started click track from', startOffset, 'seconds with gain:', previewClickTrackToggle.checked ? 1 : 0);
      }

      console.log('Preview started playback from', startOffset, 'seconds at time', startTime);

      isPreviewPlaying = true;
      previewPlayPauseBtn.textContent = '⏸';
      previewPlayPauseBtn.disabled = false;
      const totalStr = formatTime(previewBuffer.duration);
      previewPlaybackStatus.textContent = `0:00 / ${totalStr}`;

      // Start playback indicator animation from current position
      animatePreviewPlaybackIndicator();

      previewSourceNode.onended = () => {
        // Check if we actually reached the end or were stopped early (pause/reset)
        const elapsed = audioContext.currentTime - previewPlaybackStartTime;
        const reachedEnd = elapsed >= (previewBuffer.duration - 0.1);

        if (reachedEnd) {
          // Natural end of playback
          console.log('Preview playback naturally ended at', elapsed, 'seconds');

          // Stop click track when preview stem ends
          if (previewClickTrackSource) {
            try { previewClickTrackSource.stop(); } catch (e) { console.log('Preview click track already stopped'); }
            previewClickTrackSource = null;
          }
          if (previewClickTrackGainNode) {
            previewClickTrackGainNode.disconnect();
            previewClickTrackGainNode = null;
          }

          isPreviewPlaying = false;
          previewPlayPauseBtn.textContent = '▶';
          const totalStr = formatTime(previewBuffer.duration);
          previewPlaybackStatus.textContent = `${totalStr} / ${totalStr}`;
          // Keep indicator at the end
          const displayWidth = previewWaveformCanvas.getBoundingClientRect().width;
          previewPlaybackIndicator.style.left = `${displayWidth}px`;
          // Set paused position to end so pressing play will restart from beginning
          previewPlaybackPausedAt = previewBuffer.duration;
          if (previewAnimationFrame) {
            cancelAnimationFrame(previewAnimationFrame);
            previewAnimationFrame = null;
          }
        } else {
          // Stopped early (pause or reset) - don't override the pause position
          console.log('Preview audio stopped early at', elapsed, 'seconds (pause/reset)');
        }
      };
    } catch (error) {
      console.error('Error playing preview:', error);
      previewPlaybackStatus.textContent = 'Playback error';
      isPreviewPlaying = false;
      previewPlayPauseBtn.textContent = '▶';
      previewPlayPauseBtn.disabled = false;
    }
  }
}

/**
 * Animate preview playback indicator and update time display
 */
function animatePreviewPlaybackIndicator() {
  if (!isPreviewPlaying || !previewBuffer) return;

  const elapsed = audioContext.currentTime - previewPlaybackStartTime;
  const progress = elapsed / previewBuffer.duration;
  const displayWidth = previewWaveformCanvas.getBoundingClientRect().width;
  const position = progress * displayWidth;

  previewPlaybackIndicator.style.left = `${position}px`;

  // Update status text with current time
  const currentStr = formatTime(elapsed);
  const totalStr = formatTime(previewBuffer.duration);
  previewPlaybackStatus.textContent = `${currentStr} / ${totalStr}`;

  if (progress < 1) {
    previewAnimationFrame = requestAnimationFrame(animatePreviewPlaybackIndicator);
  }
}

/**
 * Handle preview reset
 */
function handlePreviewReset() {
  if (previewSourceNode) {
    previewSourceNode.stop();
    previewSourceNode = null;
  }
  if (previewClickTrackSource) {
    previewClickTrackSource.stop();
    previewClickTrackSource = null;
  }
  if (previewClickTrackGainNode) {
    previewClickTrackGainNode.disconnect();
    previewClickTrackGainNode = null;
  }
  isPreviewPlaying = false;
  previewPlaybackPausedAt = 0;
  previewPlayPauseBtn.textContent = '▶';
  if (previewBuffer) {
    const totalStr = formatTime(previewBuffer.duration);
    previewPlaybackStatus.textContent = `0:00 / ${totalStr}`;
  } else {
    previewPlaybackStatus.textContent = 'Ready to play';
  }
  previewPlaybackIndicator.style.left = '0px';
  if (previewAnimationFrame) {
    cancelAnimationFrame(previewAnimationFrame);
    previewAnimationFrame = null;
  }
}

/**
 * Handle offset slider change
 */
function handleOffsetSliderChange(event) {
  if (isUpdatingOffset) return; // Prevent double updates
  isUpdatingOffset = true;

  const newOffset = parseFloat(event.target.value);
  const offsetChange = newOffset - previousOffset;

  currentOffset = newOffset;
  offsetInput.value = currentOffset.toFixed(2);
  offsetValue.textContent = currentOffset.toFixed(2) + 's';

  console.log('Offset changed from', previousOffset, 'to', newOffset, '(change:', offsetChange, ')');

  // Stop playback if playing, but preserve pause position
  if (isPreviewPlaying) {
    if (previewSourceNode) {
      previewSourceNode.stop();
      previewSourceNode = null;
    }
    if (previewClickTrackSource) {
      previewClickTrackSource.stop();
      previewClickTrackSource = null;
    }
    if (previewClickTrackGainNode) {
      previewClickTrackGainNode.disconnect();
      previewClickTrackGainNode = null;
    }
    isPreviewPlaying = false;
    previewPlayPauseBtn.textContent = '▶';
    if (previewAnimationFrame) {
      cancelAnimationFrame(previewAnimationFrame);
      previewAnimationFrame = null;
    }
  }

  // Store old pause time before updating preview
  const oldPausedTime = previewPlaybackPausedAt;
  console.log('Old paused time:', oldPausedTime);

  // Update preview with new offset
  updatePreview();

  console.log('After updatePreview - new buffer duration:', previewBuffer ? previewBuffer.duration : 'null');

  // Adjust paused time based on offset change
  // If offset increases (trim from start), paused time decreases
  // If offset decreases (add to start), paused time increases
  if (oldPausedTime > 0 && previewBuffer) {
    const newPausedTime = oldPausedTime - offsetChange;
    console.log('Adjusting paused time by offset change - new time:', newPausedTime);

    if (newPausedTime < 0) {
      // New paused time is before the start, reset to 0
      console.log('New paused time is negative, resetting to 0');
      previewPlaybackPausedAt = 0;
      previewPlaybackIndicator.style.left = '0px';
      const totalStr = formatTime(previewBuffer.duration);
      previewPlaybackStatus.textContent = `0:00 / ${totalStr}`;
    } else if (newPausedTime > previewBuffer.duration) {
      // New paused time is beyond the end, reset to 0
      console.log('New paused time exceeds buffer duration, resetting to 0');
      previewPlaybackPausedAt = 0;
      previewPlaybackIndicator.style.left = '0px';
      const totalStr = formatTime(previewBuffer.duration);
      previewPlaybackStatus.textContent = `0:00 / ${totalStr}`;
    } else {
      // Valid time position, update indicator
      previewPlaybackPausedAt = newPausedTime;
      const progress = previewPlaybackPausedAt / previewBuffer.duration;
      const displayWidth = previewWaveformCanvas.getBoundingClientRect().width;
      const position = progress * displayWidth;
      console.log('New paused time:', newPausedTime, 'progress:', progress, 'position:', position, 'px');
      previewPlaybackIndicator.style.left = `${position}px`;
      const currentStr = formatTime(previewPlaybackPausedAt);
      const totalStr = formatTime(previewBuffer.duration);
      previewPlaybackStatus.textContent = `${currentStr} / ${totalStr}`;
    }
  } else {
    console.log('Not adjusting - oldPausedTime:', oldPausedTime, 'previewBuffer:', previewBuffer ? 'exists' : 'null');
  }

  // Update previous offset for next change
  previousOffset = newOffset;

  isUpdatingOffset = false;
}

/**
 * Handle offset input change
 */
function handleOffsetInputChange(event) {
  if (isUpdatingOffset) return; // Prevent double updates
  isUpdatingOffset = true;

  // Sanitize input - allow numbers, decimal point, and minus sign
  let sanitized = event.target.value.replace(/[^0-9.-]/g, '');

  // Ensure only one decimal point and one minus sign at the beginning
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }

  // Only allow minus sign at the beginning
  if (sanitized.indexOf('-') > 0) {
    sanitized = sanitized.replace(/-/g, '');
  }

  // Parse and validate range
  let value = parseFloat(sanitized);
  if (isNaN(value)) {
    value = 0;
  }

  // Clamp to slider range
  const min = parseFloat(offsetSlider.min);
  const max = parseFloat(offsetSlider.max);
  value = Math.max(min, Math.min(max, value));

  const newOffset = value;
  const offsetChange = newOffset - previousOffset;

  currentOffset = value;
  offsetInput.value = value.toFixed(2);
  offsetSlider.value = value;
  offsetValue.textContent = value.toFixed(2) + 's';

  console.log('Offset changed from', previousOffset, 'to', newOffset, '(change:', offsetChange, ')');

  // Stop playback if playing, but preserve pause position
  if (isPreviewPlaying) {
    if (previewSourceNode) {
      previewSourceNode.stop();
      previewSourceNode = null;
    }
    if (previewClickTrackSource) {
      previewClickTrackSource.stop();
      previewClickTrackSource = null;
    }
    if (previewClickTrackGainNode) {
      previewClickTrackGainNode.disconnect();
      previewClickTrackGainNode = null;
    }
    isPreviewPlaying = false;
    previewPlayPauseBtn.textContent = '▶';
    if (previewAnimationFrame) {
      cancelAnimationFrame(previewAnimationFrame);
      previewAnimationFrame = null;
    }
  }

  // Store old pause time before updating preview
  const oldPausedTime = previewPlaybackPausedAt;
  console.log('Old paused time:', oldPausedTime);

  // Update preview with new offset
  updatePreview();

  console.log('After updatePreview - new buffer duration:', previewBuffer ? previewBuffer.duration : 'null');

  // Adjust paused time based on offset change
  // If offset increases (trim from start), paused time decreases
  // If offset decreases (add to start), paused time increases
  if (oldPausedTime > 0 && previewBuffer) {
    const newPausedTime = oldPausedTime - offsetChange;
    console.log('Adjusting paused time by offset change - new time:', newPausedTime);

    if (newPausedTime < 0) {
      // New paused time is before the start, reset to 0
      console.log('New paused time is negative, resetting to 0');
      previewPlaybackPausedAt = 0;
      previewPlaybackIndicator.style.left = '0px';
      const totalStr = formatTime(previewBuffer.duration);
      previewPlaybackStatus.textContent = `0:00 / ${totalStr}`;
    } else if (newPausedTime > previewBuffer.duration) {
      // New paused time is beyond the end, reset to 0
      console.log('New paused time exceeds buffer duration, resetting to 0');
      previewPlaybackPausedAt = 0;
      previewPlaybackIndicator.style.left = '0px';
      const totalStr = formatTime(previewBuffer.duration);
      previewPlaybackStatus.textContent = `0:00 / ${totalStr}`;
    } else {
      // Valid time position, update indicator
      previewPlaybackPausedAt = newPausedTime;
      const progress = previewPlaybackPausedAt / previewBuffer.duration;
      const displayWidth = previewWaveformCanvas.getBoundingClientRect().width;
      const position = progress * displayWidth;
      console.log('New paused time:', newPausedTime, 'progress:', progress, 'position:', position, 'px');
      previewPlaybackIndicator.style.left = `${position}px`;
      const currentStr = formatTime(previewPlaybackPausedAt);
      const totalStr = formatTime(previewBuffer.duration);
      previewPlaybackStatus.textContent = `${currentStr} / ${totalStr}`;
    }
  } else {
    console.log('Not adjusting - oldPausedTime:', oldPausedTime, 'previewBuffer:', previewBuffer ? 'exists' : 'null');
  }

  // Update previous offset for next change
  previousOffset = newOffset;

  isUpdatingOffset = false;
}

/**
 * Update slider range
 */
function updateSliderRange() {
  // Sanitize inputs - allow numbers, decimal point, and minus sign
  sliderMin.value = sliderMin.value.replace(/[^0-9.-]/g, '');
  sliderMax.value = sliderMax.value.replace(/[^0-9.-]/g, '');

  const min = parseFloat(sliderMin.value);
  const max = parseFloat(sliderMax.value);

  // Validate that values are numbers
  if (isNaN(min) || isNaN(max)) {
    showNotification('Please enter valid numbers for range', 'warning');
    sliderMin.value = offsetSlider.min;
    sliderMax.value = offsetSlider.max;
    return;
  }

  // Validate that min < max
  if (min >= max) {
    showNotification('Minimum must be less than maximum', 'warning');
    return;
  }

  // Validate reasonable range (prevent extreme values)
  if (min < -3600 || max > 3600) {
    showNotification('Range values must be between -3600 and 3600 seconds', 'warning');
    return;
  }

  offsetSlider.min = min;
  offsetSlider.max = max;

  // Update slider value if it's outside new range
  if (currentOffset < min) {
    currentOffset = min;
    offsetSlider.value = min;
    offsetInput.value = min.toFixed(2);
    offsetValue.textContent = min.toFixed(2) + 's';
  } else if (currentOffset > max) {
    currentOffset = max;
    offsetSlider.value = max;
    offsetInput.value = max.toFixed(2);
    offsetValue.textContent = max.toFixed(2) + 's';
  }
}

/**
 * Handle save stem
 */
async function handleSaveStem() {
  if (!loadedWavBuffer) {
    showNotification('Please load a WAV file first', 'warning');
    return;
  }

  // Get the take name from input
  const takeName = takeNameInput.value.trim();
  if (!takeName) {
    showNotification('Please enter a take name', 'warning');
    return;
  }

  // Check for duplicate take name (only if creating new or renaming)
  if (takeName !== editingTake) {
    const duplicateTake = currentStems.find(
      s => s.instrument_id === editingInstrument.instrument_id && s.take === takeName
    );
    if (duplicateTake) {
      showNotification(
        `<strong>Error:</strong> A take named "${takeName}" already exists for ${editingInstrument.instrument_name}. Please choose a different name.`,
        'error'
      );
      return;
    }
  }

  try {
    saveStemBtn.disabled = true;

    await upsertStem(
      songId,
      editingInstrument.instrument_id,
      takeName,
      currentWavUrl,
      currentOffset
    );

    showNotification('<strong>Success!</strong> Take saved successfully', 'success');

    // Clear the uploaded but not saved URL since we successfully saved
    uploadedButNotSavedUrl = '';

    // Reload stems
    currentStems = await getStemsBySong(songId);

    // Initialize selected take if not already set
    if (!selectedTakes[editingInstrument.instrument_id]) {
      const takes = currentStems.filter(s => s.instrument_id === editingInstrument.instrument_id);
      selectedTakes[editingInstrument.instrument_id] = takes[0]?.take;
    }

    renderStemMixer();
    await updateClickTrackDuration();

    // Rebuild mix and waveform with new stem
    await rebuildMixAndWaveform();

    // Go back to instrument list to show updated takes
    await showInstrumentList();
  } catch (error) {
    saveStemBtn.disabled = false;
    showNotification(`<strong>Error saving take:</strong> ${error.message}`, 'error');
  }
}

/**
 * Handle delete stem button click - show modal
 */
async function handleDeleteStem() {
  // Show modal
  deleteStemModal.classList.add('active');
}

/**
 * Hide delete stem modal
 */
function hideDeleteStemModal() {
  deleteStemModal.classList.remove('active');
  confirmDeleteStemBtn.disabled = false;
}

/**
 * Confirm delete stem
 */
async function confirmDeleteStem() {
  try {
    confirmDeleteStemBtn.disabled = true;

    // Delete the take
    await deleteStem(songId, editingInstrument.instrument_id, editingTake);

    // Close delete modal
    hideDeleteStemModal();

    showNotification('<strong>Success!</strong> Take deleted successfully', 'success');

    // Reload stems
    currentStems = await getStemsBySong(songId);

    // Clear selected take if it was the deleted one
    if (selectedTakes[editingInstrument.instrument_id] === editingTake) {
      const takes = currentStems.filter(s => s.instrument_id === editingInstrument.instrument_id);
      selectedTakes[editingInstrument.instrument_id] = takes[0]?.take;
    }

    renderStemMixer();
    await updateClickTrackDuration();

    // Rebuild mix and waveform without the deleted stem
    await rebuildMixAndWaveform();

    // Go back to instrument list to show updated takes
    await showInstrumentList();

  } catch (error) {
    confirmDeleteStemBtn.disabled = false;
    hideDeleteStemModal();
    showNotification(`<strong>Error deleting take:</strong> ${error.message}`, 'error');
  }
}

/**
 * Show delete song modal
 */
function handleDeleteSong() {
  if (!currentSong) return;

  // Build song details for display
  const songDisplayName = currentSong.title
    ? `<strong>${currentSong.song_id}: ${currentSong.title}</strong>`
    : `<strong>Song ${currentSong.song_id}</strong>`;

  deleteSongDetails.innerHTML = `
    <p style="margin: 5px 0;">${songDisplayName}</p>
    <ul style="margin: 5px 0; padding-left: 20px;">
      <li>The song record</li>
      <li>All ${currentStems.length} stem(s) for this song</li>
      <li>All associated WAV files</li>
    </ul>
  `;

  // Reset password input and error
  deleteSongAdminPassword.value = '';
  deleteSongPasswordError.style.display = 'none';

  // Show modal
  deleteSongModal.classList.add('active');
  setTimeout(() => deleteSongAdminPassword.focus(), 100);
}

/**
 * Hide delete song modal
 */
function hideDeleteSongModal() {
  deleteSongModal.classList.remove('active');
  deleteSongAdminPassword.value = '';
  deleteSongPasswordError.style.display = 'none';
  confirmDeleteSongBtn.disabled = false;
}

/**
 * Confirm delete song (after password verification)
 */
async function confirmDeleteSong() {
  // Validate admin password
  const password = deleteSongAdminPassword.value;
  if (!password) {
    deleteSongPasswordError.textContent = 'Admin password is required';
    deleteSongPasswordError.style.display = 'block';
    return;
  }

  try {
    confirmDeleteSongBtn.disabled = true;

    // Get passwords from database
    const passwords = await getPasswords();
    if (!passwords) {
      throw new Error('Passwords not configured');
    }

    // Verify admin password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex !== passwords.admin_password_hash) {
      throw new Error('Incorrect admin password');
    }

    // Delete the song (will also delete all stems and WAV files)
    await deleteSong(songId);

    // Close modal
    hideDeleteSongModal();

    showNotification('<strong>Success!</strong> Song deleted successfully. Redirecting...', 'success');

    // Redirect to song list after short delay
    setTimeout(() => {
      window.location.href = 'song-list.html';
    }, 1500);

  } catch (error) {
    confirmDeleteSongBtn.disabled = false;
    deleteSongPasswordError.textContent = error.message;
    deleteSongPasswordError.style.display = 'block';
  }
}

/**
 * Reset modal state
 */
async function resetModalState() {
  // Delete uploaded but not saved file from storage
  if (uploadedButNotSavedUrl) {
    try {
      await deleteWavFile(uploadedButNotSavedUrl);
      console.log('Deleted unsaved uploaded file:', uploadedButNotSavedUrl);
    } catch (error) {
      console.warn('Could not delete uploaded file:', error);
    }
    uploadedButNotSavedUrl = '';
  }

  wavFileInput.value = '';
  wavLoadedSection.classList.add('hidden');
  editingExistingTakeBanner.classList.add('hidden'); // Hide banner when starting fresh
  uploadProgress.classList.add('hidden');
  uploadProgressBar.style.width = '0%';
  loadWavBtn.disabled = false;
  saveStemBtn.disabled = false;
  deleteStemBtn.disabled = false;
  deleteStemBtn.style.display = 'none'; // Hide delete button by default
  currentWavUrl = '';
  currentOffset = 0;
  previousOffset = 0; // Reset previous offset
  offsetSlider.value = 0;
  offsetInput.value = 0;
  offsetValue.textContent = '0.00s';
  sliderMin.value = -5;
  sliderMax.value = 5;
  updateSliderRange();
  loadedWavBuffer = null;
  previewBuffer = null;

  if (previewSourceNode) {
    previewSourceNode.stop();
    previewSourceNode = null;
  }
  if (previewClickTrackSource) {
    previewClickTrackSource.stop();
    previewClickTrackSource = null;
  }
  if (previewClickTrackGainNode) {
    previewClickTrackGainNode.disconnect();
    previewClickTrackGainNode = null;
  }
}
