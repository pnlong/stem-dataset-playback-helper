// Song list page logic
import { getAllSongs, getAllInstruments, getStemCounts, getAllStems, deleteAllData, verifyAdminPassword, getPasswords, addSong } from './db.js';
import { checkWebsiteAuth } from './auth-check.js';

// Rate limiting configuration for admin password
const MAX_ADMIN_ATTEMPTS = 5;
const ADMIN_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const ADMIN_STORAGE_KEY = 'adminPasswordAttempts';

let allSongs = [];
let allInstruments = [];
let stemCounts = {};

// Get DOM elements
const loadingSpinner = document.getElementById('loadingSpinner');
const songsGrid = document.getElementById('songsGrid');
const emptyState = document.getElementById('emptyState');
const searchBox = document.getElementById('searchBox');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressDetails = document.getElementById('progressDetails');
const resetModal = document.getElementById('resetModal');
const closeResetModal = document.getElementById('closeResetModal');
const confirmResetBtn = document.getElementById('confirmResetBtn');
const cancelResetBtn = document.getElementById('cancelResetBtn');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const passwordError = document.getElementById('passwordError');
const passwordSection = document.getElementById('passwordSection');
const downloadConfirmModal = document.getElementById('downloadConfirmModal');
const closeDownloadConfirmModal = document.getElementById('closeDownloadConfirmModal');
const confirmDownloadBtn = document.getElementById('confirmDownloadBtn');
const cancelDownloadBtn = document.getElementById('cancelDownloadBtn');
const applyOffsetsToggle = document.getElementById('applyOffsetsToggle');
const downloadModal = document.getElementById('downloadModal');
const downloadStatusText = document.getElementById('downloadStatusText');
const downloadProgressBar = document.getElementById('downloadProgressBar');
const downloadProgressDetails = document.getElementById('downloadProgressDetails');
const addSongModal = document.getElementById('addSongModal');
const closeAddSongModal = document.getElementById('closeAddSongModal');
const confirmAddSongBtn = document.getElementById('confirmAddSongBtn');
const cancelAddSongBtn = document.getElementById('cancelAddSongBtn');
const newSongTitle = document.getElementById('newSongTitle');
const newSongId = document.getElementById('newSongId');
const newSongBpm = document.getElementById('newSongBpm');
const newSongTimeSignatureNumerator = document.getElementById('newSongTimeSignatureNumerator');
const newSongTimeSignatureDenominator = document.getElementById('newSongTimeSignatureDenominator');
const addSongAdminPassword = document.getElementById('addSongAdminPassword');
const songIdError = document.getElementById('songIdError');
const bpmError = document.getElementById('bpmError');
const timeSignatureError = document.getElementById('timeSignatureError');
const adminPasswordError = document.getElementById('adminPasswordError');
const adminPasswordSection = document.getElementById('adminPasswordSection');

// Event listeners - attach these FIRST so Reset button always works
searchBox.addEventListener('input', handleSearch);
downloadBtn.addEventListener('click', showDownloadConfirmModal);
confirmDownloadBtn.addEventListener('click', () => {
  downloadConfirmModal.classList.remove('active');
  handleDownload();
});
cancelDownloadBtn.addEventListener('click', hideDownloadConfirmModal);
closeDownloadConfirmModal.addEventListener('click', hideDownloadConfirmModal);
downloadConfirmModal.addEventListener('click', (e) => {
  if (e.target === downloadConfirmModal) hideDownloadConfirmModal();
});
resetBtn.addEventListener('click', showResetModal);
closeResetModal.addEventListener('click', hideResetModal);
cancelResetBtn.addEventListener('click', hideResetModal);
confirmResetBtn.addEventListener('click', handleReset);
resetModal.addEventListener('click', (e) => {
  if (e.target === resetModal) hideResetModal();
});
adminPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleReset();
  }
});
closeAddSongModal.addEventListener('click', hideAddSongModal);
cancelAddSongBtn.addEventListener('click', hideAddSongModal);
confirmAddSongBtn.addEventListener('click', handleAddSong);
addSongModal.addEventListener('click', (e) => {
  if (e.target === addSongModal) hideAddSongModal();
});

// Initialize with auth checks
(async () => {
  try {
    // Check if passwords are set - if not, redirect to welcome page
    const existingPasswords = await getPasswords();
    if (!existingPasswords) {
      // No passwords set, redirect to welcome page
      window.location.href = 'welcome.html';
      return;
    }

    // Check authentication (will redirect to login if not authenticated)
    checkWebsiteAuth();

    // Load data on page load
    init();
  } catch (error) {
    console.error('Error during initialization:', error);
    loadingSpinner.innerHTML = `
      <div class="alert alert-error">
        <strong>Error:</strong> ${error.message}
        <br><br>
        You can still use "Reset Everything" button to clear the database and start fresh.
      </div>
    `;
  }
})();

/**
 * Initialize page
 */
async function init() {
  try {
    // Load all data
    [allSongs, allInstruments, stemCounts] = await Promise.all([
      getAllSongs(),
      getAllInstruments(),
      getStemCounts()
    ]);

    // Hide loading, show content
    loadingSpinner.classList.add('hidden');
    songsGrid.classList.remove('hidden');

    // Calculate and display progress
    updateProgress();

    // Render songs
    renderSongs(allSongs);
  } catch (error) {
    console.error('Error loading data:', error);
    loadingSpinner.innerHTML = `
      <div class="alert alert-error">
        <strong>Error loading data:</strong> ${error.message}
        <br><br>
        Make sure your Supabase credentials are configured correctly in config.js
      </div>
    `;
  }
}

/**
 * Update progress bar
 */
function updateProgress() {
  const totalSongs = allSongs.length;
  const totalInstruments = allInstruments.length;
  const totalPossibleStems = totalSongs * totalInstruments;
  const totalCompletedStems = Object.values(stemCounts).reduce((sum, count) => sum + count, 0);

  const percentage = totalPossibleStems > 0
    ? Math.round((totalCompletedStems / totalPossibleStems) * 100)
    : 0;

  progressFill.style.width = percentage + '%';
  progressText.textContent = percentage + '%';

  progressDetails.textContent = `${totalCompletedStems} of ${totalPossibleStems} stems completed (${totalSongs} songs × ${totalInstruments} instruments)`;
}

/**
 * Render song cards
 */
function renderSongs(songs) {
  songsGrid.classList.remove('hidden');
  emptyState.classList.add('hidden');

  // Add "Add New Song" card at the end
  const addSongCard = `
    <div class="card card-clickable" onclick="window.showAddSongModal()" style="border: 2px dashed var(--primary); background-color: #f0f7ff; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 150px;">
      <div style="font-size: 3rem; color: var(--primary); margin-bottom: 10px;">+</div>
      <div class="card-title" style="color: var(--primary);">Add New Song</div>
    </div>
  `;

  if (songs.length === 0) {
    // Only show the add song card
    songsGrid.innerHTML = addSongCard;
    return;
  }

  const songCards = songs.map(song => {
    const songStemCount = stemCounts[song.song_id] || 0;
    const totalInstruments = allInstruments.length;
    const progressPercent = totalInstruments > 0
      ? Math.round((songStemCount / totalInstruments) * 100)
      : 0;

    return `
      <div class="card card-clickable" onclick="location.href='song-detail.html?song_id=${song.song_id}'">
        <div class="card-title">
          ${song.title ? `${song.song_id}: ${song.title}` : `Song ${song.song_id}`}
        </div>
        <div class="card-subtitle">
          BPM: ${song.bpm} • ${song.time_signature || '4/4'}
        </div>
        <div class="mt-2">
          <small class="text-secondary">
            ${songStemCount} of ${totalInstruments} stems (${progressPercent}%)
          </small>
          <div class="progress-bar" style="height: 8px; margin-top: 5px;">
            <div class="progress-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  songsGrid.innerHTML = songCards + addSongCard;
}

/**
 * Apply offset to WAV file
 * @param {ArrayBuffer} arrayBuffer - Original WAV file data
 * @param {number} offsetSeconds - Offset in seconds (positive = trim beginning, negative = add silence)
 * @returns {Promise<Blob>} - Modified WAV file as Blob
 */
async function applyOffsetToWAV(arrayBuffer, offsetSeconds) {
  // Create an AudioContext for decoding
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Decode the WAV file
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const offsetSamples = Math.round(Math.abs(offsetSeconds) * sampleRate);

  let newBuffer;

  if (offsetSeconds > 0) {
    // Positive offset: trim the beginning
    const newLength = Math.max(0, audioBuffer.length - offsetSamples);
    newBuffer = audioContext.createBuffer(numberOfChannels, newLength, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = audioBuffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      for (let i = 0; i < newLength; i++) {
        newData[i] = originalData[i + offsetSamples];
      }
    }
  } else if (offsetSeconds < 0) {
    // Negative offset: add silence to the beginning
    const newLength = audioBuffer.length + offsetSamples;
    newBuffer = audioContext.createBuffer(numberOfChannels, newLength, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = audioBuffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      // Fill with silence (zeros) for the offset duration
      for (let i = 0; i < offsetSamples; i++) {
        newData[i] = 0;
      }
      // Copy original data after the silence
      for (let i = 0; i < audioBuffer.length; i++) {
        newData[i + offsetSamples] = originalData[i];
      }
    }
  } else {
    // No offset, return original
    newBuffer = audioBuffer;
  }

  // Convert AudioBuffer to WAV Blob
  const wavBlob = audioBufferToWav(newBuffer);

  // Close audio context to free resources
  await audioContext.close();

  return wavBlob;
}

/**
 * Convert AudioBuffer to WAV Blob
 * @param {AudioBuffer} audioBuffer - Audio buffer to convert
 * @returns {Blob} - WAV file as Blob
 */
function audioBufferToWav(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const data = interleave(audioBuffer);
  const dataLength = data.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio data
  floatTo16BitPCM(view, 44, data);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Interleave audio channels
 */
function interleave(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels;
  const result = new Float32Array(length);

  let offset = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      result[offset++] = audioBuffer.getChannelData(channel)[i];
    }
  }

  return result;
}

/**
 * Write string to DataView
 */
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convert float samples to 16-bit PCM
 */
function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

/**
 * Show download confirmation modal
 */
function showDownloadConfirmModal() {
  downloadConfirmModal.classList.add('active');
}

/**
 * Hide download confirmation modal
 */
function hideDownloadConfirmModal() {
  downloadConfirmModal.classList.remove('active');
}

/**
 * Handle search
 */
function handleSearch(event) {
  const searchTerm = event.target.value.trim().toLowerCase();

  if (!searchTerm) {
    renderSongs(allSongs);
    return;
  }

  const filtered = allSongs.filter(song =>
    song.song_id.toString().includes(searchTerm) ||
    (song.title && song.title.toLowerCase().includes(searchTerm))
  );

  renderSongs(filtered);
}

/**
 * Handle download all data as ZIP
 */
async function handleDownload() {
  try {
    // Check if we should apply offsets
    const applyOffsets = applyOffsetsToggle.checked;

    // Show download modal
    downloadModal.classList.add('active');
    downloadStatusText.textContent = 'Loading data...';
    downloadProgressBar.style.width = '10%';
    downloadProgressDetails.textContent = '';

    // Fetch all data
    const [songs, stems, instruments] = await Promise.all([
      getAllSongs(),
      getAllStems(),
      getAllInstruments()
    ]);

    // Build list of WAV files from stems (only files actually referenced)
    const wavFiles = stems.map(stem => ({
      url: stem.wav_url,
      name: stem.wav_url.split('/').pop()
    }));

    downloadProgressBar.style.width = '20%';
    downloadStatusText.textContent = 'Creating CSV files...';

    // Create ZIP file
    const zip = new JSZip();

    // Create songs.csv
    const songsCsv = [
      'song_id,title,bpm,time_signature',
      ...songs.map(song => `${song.song_id},"${(song.title || '').replace(/"/g, '""')}",${song.bpm},"${song.time_signature || '4/4'}"`)
    ].join('\n');
    zip.file('songs.csv', songsCsv);

    downloadProgressBar.style.width = '30%';

    // Create instruments.csv
    const instrumentsCsv = [
      'instrument_id,instrument_name,order_index',
      ...instruments.map(inst => `${inst.instrument_id},"${inst.instrument_name.replace(/"/g, '""')}",${inst.order_index}`)
    ].join('\n');
    zip.file('instruments.csv', instrumentsCsv);

    downloadProgressBar.style.width = '40%';

    // Create stems.csv with joined data
    downloadStatusText.textContent = 'Creating stems table...';
    const stemsWithInstruments = stems.map(stem => {
      const instrument = instruments.find(i => i.instrument_id === stem.instrument_id);
      const song = songs.find(s => s.song_id === stem.song_id);
      return {
        ...stem,
        instrument_name: instrument ? instrument.instrument_name : 'Unknown',
        instrument_order: instrument ? instrument.order_index : -1,
        song_title: song ? song.title : '',
        bpm: song ? song.bpm : 0
      };
    });

    const stemsCsv = [
      'song_id,song_title,bpm,instrument_id,instrument_name,instrument_order,take,wav_file_path,offset_seconds',
      ...stemsWithInstruments.map(stem => {
        // Extract filename from URL for relative path
        const filename = stem.wav_url.split('/').pop();
        const relativePath = `wav_files/${filename}`;
        // If applying offsets, set offset to 0 since it's baked into the WAV file
        const offsetValue = applyOffsets ? 0 : stem.offset_seconds;
        return `${stem.song_id},"${(stem.song_title || '').replace(/"/g, '""')}",${stem.bpm},${stem.instrument_id},"${stem.instrument_name.replace(/"/g, '""')}",${stem.instrument_order},"${stem.take.replace(/"/g, '""')}","${relativePath}",${offsetValue}`;
      })
    ].join('\n');
    zip.file('stems.csv', stemsCsv);

    downloadProgressBar.style.width = '50%';

    // Create a mapping from WAV filename to offset
    const wavFileOffsets = {};
    if (applyOffsets) {
      stems.forEach(stem => {
        const filename = stem.wav_url.split('/').pop();
        wavFileOffsets[filename] = stem.offset_seconds;
      });
    }

    // Download WAV files
    if (wavFiles.length > 0) {
      downloadStatusText.textContent = `Downloading ${wavFiles.length} WAV files...`;
      const wavFolder = zip.folder('wav_files');

      for (let i = 0; i < wavFiles.length; i++) {
        const wavFile = wavFiles[i];
        const progress = 50 + (i / wavFiles.length) * 40;
        downloadProgressBar.style.width = `${progress}%`;
        downloadProgressDetails.textContent = `${applyOffsets ? 'Processing' : 'Downloading'} ${i + 1}/${wavFiles.length}: ${wavFile.name}`;

        try {
          // Fetch WAV file
          const response = await fetch(wavFile.url);
          if (!response.ok) {
            console.error(`Failed to download ${wavFile.name}:`, response.statusText);
            continue;
          }

          if (applyOffsets && wavFileOffsets[wavFile.name] !== undefined) {
            // Apply offset to this WAV file
            const arrayBuffer = await response.arrayBuffer();
            const processedBlob = await applyOffsetToWAV(arrayBuffer, wavFileOffsets[wavFile.name]);
            wavFolder.file(wavFile.name, processedBlob);
          } else {
            // No offset to apply, use as-is
            const blob = await response.blob();
            wavFolder.file(wavFile.name, blob);
          }
        } catch (error) {
          console.error(`Error processing ${wavFile.name}:`, error);
          // Continue with other files even if one fails
        }
      }
    }

    downloadProgressBar.style.width = '90%';
    downloadStatusText.textContent = 'Creating ZIP file...';
    downloadProgressDetails.textContent = 'This may take a moment...';

    // Generate ZIP
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, (metadata) => {
      // Update progress during ZIP generation
      const progress = 90 + (metadata.percent * 0.1);
      downloadProgressBar.style.width = `${progress}%`;
    });

    downloadProgressBar.style.width = '100%';
    downloadStatusText.textContent = 'Download complete!';
    downloadProgressDetails.textContent = 'Starting download...';

    // Trigger download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `stem-dataset-${timestamp}.zip`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = filename;
    link.click();

    // Clean up
    URL.revokeObjectURL(link.href);

    // Close modal after short delay
    setTimeout(() => {
      downloadModal.classList.remove('active');
      downloadProgressBar.style.width = '0%';
    }, 1500);

  } catch (error) {
    console.error('Error creating download:', error);
    downloadStatusText.textContent = 'Error creating download';
    downloadProgressDetails.textContent = error.message;
    downloadProgressBar.style.width = '0%';
    downloadProgressBar.style.backgroundColor = 'var(--danger)';

    // Allow closing modal on error
    setTimeout(() => {
      downloadModal.addEventListener('click', () => {
        downloadModal.classList.remove('active');
        downloadProgressBar.style.width = '0%';
        downloadProgressBar.style.backgroundColor = 'var(--primary)';
      }, { once: true });
    }, 100);
  }
}

/**
 * Show reset confirmation modal
 */
async function showResetModal() {
  // Check if passwords exist to determine whether to show password field
  const passwords = await getPasswords();

  if (passwords) {
    // Check for lockout status
    const lockoutMinutes = checkAdminLockout();

    // Show password section
    passwordSection.style.display = 'block';
    adminPasswordInput.value = '';
    passwordError.style.display = 'none';
    adminPasswordInput.disabled = false;
    confirmResetBtn.disabled = false;

    // If locked out, show message and disable input
    if (lockoutMinutes > 0) {
      passwordError.innerHTML = `<strong>Too many failed attempts.</strong><br>Please try again in ${lockoutMinutes} minute${lockoutMinutes !== 1 ? 's' : ''}.`;
      passwordError.style.display = 'block';
      adminPasswordInput.disabled = true;
      confirmResetBtn.disabled = true;
    }
  } else {
    // Hide password section if no passwords set
    passwordSection.style.display = 'none';
  }

  resetModal.classList.add('active');

  // Focus password input if visible and not locked out
  if (passwords && checkAdminLockout() === 0) {
    setTimeout(() => adminPasswordInput.focus(), 100);
  }
}

/**
 * Hide reset confirmation modal
 */
function hideResetModal() {
  resetModal.classList.remove('active');
  adminPasswordInput.value = '';
  passwordError.style.display = 'none';
}

/**
 * Get admin password attempts from localStorage
 */
function getAdminAttempts() {
  const data = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (!data) {
    return { count: 0, lockedUntil: null };
  }
  return JSON.parse(data);
}

/**
 * Save admin password attempts to localStorage
 */
function saveAdminAttempts(count, lockedUntil = null) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ count, lockedUntil }));
}

/**
 * Check if admin password is locked out
 */
function checkAdminLockout() {
  const attempts = getAdminAttempts();

  if (attempts.lockedUntil) {
    const now = Date.now();
    const timeRemaining = attempts.lockedUntil - now;

    if (timeRemaining > 0) {
      // Still locked out
      const minutesRemaining = Math.ceil(timeRemaining / 60000);
      return minutesRemaining;
    } else {
      // Lockout expired, reset attempts
      saveAdminAttempts(0, null);
      return 0;
    }
  }

  return 0;
}

/**
 * Handle reset button
 */
async function handleReset() {
  try {
    // Check if passwords exist
    const passwords = await getPasswords();

    if (passwords) {
      // Check for admin lockout
      const lockoutMinutes = checkAdminLockout();
      if (lockoutMinutes > 0) {
        passwordError.innerHTML = `<strong>Too many failed attempts.</strong><br>Please try again in ${lockoutMinutes} minute${lockoutMinutes !== 1 ? 's' : ''}.`;
        passwordError.style.display = 'block';
        adminPasswordInput.disabled = true;
        confirmResetBtn.disabled = true;
        return;
      }

      // Passwords exist, require admin password
      const password = adminPasswordInput.value.trim();

      if (!password) {
        passwordError.textContent = 'Please enter the admin password';
        passwordError.style.display = 'block';
        return;
      }

      // Verify admin password
      const isValid = await verifyAdminPassword(password);

      if (!isValid) {
        // Failed attempt - increment counter
        const attempts = getAdminAttempts();
        const newCount = attempts.count + 1;

        if (newCount >= MAX_ADMIN_ATTEMPTS) {
          // Lock out the user
          const lockedUntil = Date.now() + ADMIN_LOCKOUT_DURATION;
          saveAdminAttempts(newCount, lockedUntil);
          passwordError.innerHTML = `<strong>Too many failed attempts.</strong><br>Please try again in ${Math.ceil(ADMIN_LOCKOUT_DURATION / 60000)} minutes.`;
          passwordError.style.display = 'block';
          adminPasswordInput.disabled = true;
          confirmResetBtn.disabled = true;
        } else {
          // Show error with remaining attempts
          saveAdminAttempts(newCount, null);
          const remainingAttempts = MAX_ADMIN_ATTEMPTS - newCount;
          passwordError.textContent = `Incorrect admin password. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`;
          passwordError.style.display = 'block';
          adminPasswordInput.value = '';
          adminPasswordInput.focus();
        }
        return;
      }

      // Success - reset attempts
      saveAdminAttempts(0, null);
    }

    // If we get here, password is correct (or no password required)
    hideResetModal();

    // Delete all data
    await deleteAllData();

    // Clear session password so user has to re-enter on next visit
    sessionStorage.removeItem('websitePasswordEntered');

    // Clear rate limiting data since everything is being reset
    localStorage.removeItem(ADMIN_STORAGE_KEY);

    window.location.href = 'welcome.html';
  } catch (error) {
    console.error('Error during reset:', error);
    hideResetModal();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translateX(-50%)';
    errorDiv.style.zIndex = '10000';
    errorDiv.innerHTML = `<strong>Error deleting data:</strong> ${error.message}`;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
}

/**
 * Show add song modal
 */
window.showAddSongModal = function() {
  // Auto-generate song ID (max existing ID + 1, or 0 if no songs)
  const autoGeneratedId = allSongs.length > 0 ? Math.max(...allSongs.map(s => s.song_id)) + 1 : 0;

  // Reset form with defaults
  newSongTitle.value = '';
  newSongId.value = autoGeneratedId.toString();
  newSongBpm.value = '120';
  newSongTimeSignatureNumerator.value = '4';
  newSongTimeSignatureDenominator.value = '4';
  addSongAdminPassword.value = '';

  // Hide all error messages
  songIdError.style.display = 'none';
  bpmError.style.display = 'none';
  timeSignatureError.style.display = 'none';
  adminPasswordError.style.display = 'none';

  // Show admin password section from the start
  adminPasswordSection.classList.remove('hidden');

  addSongModal.classList.add('active');
  setTimeout(() => newSongTitle.focus(), 100);
};

/**
 * Hide add song modal
 */
function hideAddSongModal() {
  addSongModal.classList.remove('active');
}

/**
 * Handle add song
 */
async function handleAddSong() {
  // Clear previous errors
  songIdError.style.display = 'none';
  bpmError.style.display = 'none';
  timeSignatureError.style.display = 'none';
  adminPasswordError.style.display = 'none';

  let hasError = false;

  // Validate title (required)
  const title = newSongTitle.value.trim();
  if (!title) {
    adminPasswordError.textContent = 'Title is required';
    adminPasswordError.style.display = 'block';
    return;
  }

  // Validate Song ID (required, must be non-negative, must not already exist)
  const songIdValue = newSongId.value.trim();
  if (!songIdValue) {
    songIdError.textContent = 'Song ID is required';
    songIdError.style.display = 'block';
    return;
  }
  const songId = parseInt(songIdValue);
  if (isNaN(songId) || songId < 0) {
    songIdError.textContent = 'Song ID must be a non-negative number';
    songIdError.style.display = 'block';
    return;
  }
  // Check for duplicate Song ID
  if (allSongs.some(s => s.song_id === songId)) {
    songIdError.textContent = `Song ID ${songId} is already in use`;
    songIdError.style.display = 'block';
    return;
  }

  // Validate BPM (optional, defaults to 120)
  const bpmValue = newSongBpm.value.trim();
  const bpm = bpmValue ? parseInt(bpmValue) : 120;
  if (bpmValue && (isNaN(bpm) || bpm <= 0 || bpm > 300)) {
    bpmError.textContent = 'BPM must be between 1 and 300';
    bpmError.style.display = 'block';
    hasError = true;
  }

  // Validate time signature (optional, defaults to 4/4)
  const numeratorValue = newSongTimeSignatureNumerator.value.trim();
  const denominatorValue = newSongTimeSignatureDenominator.value.trim();
  const numerator = numeratorValue ? parseInt(numeratorValue) : 4;
  const denominator = denominatorValue ? parseInt(denominatorValue) : 4;

  if (numeratorValue && (isNaN(numerator) || numerator <= 0 || numerator > 32)) {
    timeSignatureError.textContent = 'Numerator must be between 1 and 32';
    timeSignatureError.style.display = 'block';
    hasError = true;
  }

  if (denominatorValue && (isNaN(denominator) || denominator <= 0 || denominator > 32)) {
    timeSignatureError.textContent = 'Denominator must be between 1 and 32';
    timeSignatureError.style.display = 'block';
    hasError = true;
  }

  const validDenominators = [1, 2, 4, 8, 16, 32];
  if (denominatorValue && !isNaN(denominator) && !validDenominators.includes(denominator)) {
    timeSignatureError.textContent = 'Denominator must be 1, 2, 4, 8, 16, or 32';
    timeSignatureError.style.display = 'block';
    hasError = true;
  }

  if (hasError) {
    return;
  }

  // Validate admin password
  const password = addSongAdminPassword.value;
  if (!password) {
    adminPasswordError.textContent = 'Admin password is required';
    adminPasswordError.style.display = 'block';
    return;
  }

  try {
    confirmAddSongBtn.disabled = true;

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

    // Add the song (songId is already validated and parsed above)
    const timeSignature = `${numerator}/${denominator}`;

    await addSong(songId, title, bpm, timeSignature);

    // Reload data
    allSongs = await getAllSongs();
    stemCounts = await getStemCounts();

    // Update UI
    updateProgress();
    renderSongs(allSongs);

    // Close modal
    hideAddSongModal();

    // Show success message
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.style.position = 'fixed';
    successDiv.style.top = '20px';
    successDiv.style.left = '50%';
    successDiv.style.transform = 'translateX(-50%)';
    successDiv.style.zIndex = '10000';
    successDiv.innerHTML = `<strong>Success!</strong> Song "${title}" added successfully (ID: ${songId})`;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);

  } catch (error) {
    confirmAddSongBtn.disabled = false;
    adminPasswordError.textContent = error.message;
    adminPasswordError.style.display = 'block';
  }
}
