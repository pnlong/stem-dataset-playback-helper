// Song upload page logic
import { upsertSongs, getPasswords, checkSetupStatus } from './db.js';
import { checkWebsiteAuth } from './auth-check.js';

// Check if passwords are already set - if so, check if database is already populated
const existingPasswords = await getPasswords();
if (!existingPasswords) {
  // No passwords set, redirect to password setup
  window.location.href = 'passwords-setup.html';
  throw new Error('Redirecting'); // Stop execution
}

// Passwords exist, check if data already exists to prevent accidental re-upload
const status = await checkSetupStatus();
if (status.hasSongs) {
  // Data already exists, redirect to home page to prevent accidental re-upload
  window.location.href = 'song-list.html';
  throw new Error('Redirecting'); // Stop execution
}

// Check authentication (will redirect to login if not authenticated)
checkWebsiteAuth();

// Get DOM elements
const manualSongIdToggle = document.getElementById('manualSongIdToggle');
const songsTableBody = document.getElementById('songsTableBody');
const addRowBtn = document.getElementById('addRowBtn');
const csvFileInput = document.getElementById('csvFile');
const csvStatus = document.getElementById('csvStatus');
const submitBtn = document.getElementById('submitBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const validationError = document.getElementById('validationError');

// Track rows
let rowCount = 0;

// Event listeners
manualSongIdToggle.addEventListener('change', handleSongIdToggleChange);
addRowBtn.addEventListener('click', addRow);
csvFileInput.addEventListener('change', handleCSVUpload);
submitBtn.addEventListener('click', handleSubmit);

// Initialize with one empty row
addRow();

/**
 * Handle manual song ID toggle change
 */
function handleSongIdToggleChange() {
  const songIdColumns = document.querySelectorAll('.song-id-column');

  if (manualSongIdToggle.checked) {
    // Show song ID column
    songIdColumns.forEach(col => col.classList.remove('hidden'));
  } else {
    // Hide song ID column
    songIdColumns.forEach(col => col.classList.add('hidden'));
  }
}

/**
 * Add a new row to the table
 */
function addRow(data = {}) {
  const row = document.createElement('tr');
  row.dataset.rowId = rowCount;

  // Default values: BPM = 120, Time Signature = 4/4
  const bpmValue = data.bpm !== undefined ? data.bpm : 120;
  const timeSignatureValue = data.time_signature || '4/4';

  row.innerHTML = `
    <td class="song-id-column hidden">
      <input type="number" class="song-id-input" placeholder="0" min="0" value="${data.song_id !== undefined ? data.song_id : ''}">
    </td>
    <td>
      <input type="text" class="title-input" placeholder="Song Title" required value="${data.title || ''}">
    </td>
    <td>
      <input type="number" class="bpm-input" min="1" max="300" value="${bpmValue}">
    </td>
    <td>
      <input type="text" class="time-signature-input" value="${timeSignatureValue}">
    </td>
    <td>
      <button class="delete-row-btn" onclick="window.deleteRow(${rowCount})" title="Delete row">🗑️</button>
    </td>
  `;

  songsTableBody.appendChild(row);
  rowCount++;
}

/**
 * Delete a row from the table
 */
window.deleteRow = function(rowId) {
  const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
  if (row) {
    row.remove();
  }
};

/**
 * Handle CSV file upload
 */
async function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsedSongs = parseCSV(text);

    // Clear existing rows
    songsTableBody.innerHTML = '';
    rowCount = 0;

    // Check if CSV has song_id column
    const hasSongIdColumn = parsedSongs.some(song => song.song_id !== undefined);

    if (hasSongIdColumn) {
      // Force enable manual song ID toggle
      manualSongIdToggle.checked = true;
      handleSongIdToggleChange();
    }

    // Populate table with CSV data
    parsedSongs.forEach(song => addRow(song));

    csvStatus.innerHTML = `<div class="alert alert-success">✓ CSV loaded successfully. ${parsedSongs.length} songs added to table.</div>`;
    csvStatus.classList.remove('hidden');

    // Clear file input
    csvFileInput.value = '';

  } catch (error) {
    csvStatus.innerHTML = `<div class="alert alert-error"><strong>Error:</strong> ${error.message}</div>`;
    csvStatus.classList.remove('hidden');
  }
}

/**
 * Parse CSV line properly handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote ("")
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state (don't add the quote itself)
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}

/**
 * Parse CSV text into song objects
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Parse header
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  // Find column indexes (only title is truly required)
  const titleIndex = header.indexOf('title');
  const songIdIndex = header.indexOf('song_id');
  const bpmIndex = header.indexOf('bpm');
  const timeSignatureIndex = header.indexOf('time_signature');

  if (titleIndex === -1) {
    throw new Error('CSV must have a "title" column');
  }

  // Parse data rows
  const songs = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);

    const song = {
      title: (values[titleIndex] || '').trim()
    };

    // Optional song_id
    if (songIdIndex !== -1) {
      const songIdValue = (values[songIdIndex] || '').trim();
      if (songIdValue) {
        song.song_id = parseInt(songIdValue);
      }
    }

    // Optional bpm (will default to 120 if not provided or empty)
    if (bpmIndex !== -1) {
      const bpmValue = (values[bpmIndex] || '').trim();
      if (bpmValue) {
        song.bpm = parseInt(bpmValue);
      }
    }

    // Optional time_signature (will default to 4/4 if not provided or empty)
    if (timeSignatureIndex !== -1) {
      const timeSignatureValue = (values[timeSignatureIndex] || '').trim();
      if (timeSignatureValue) {
        song.time_signature = timeSignatureValue;
      }
    }

    if (song.title) { // Only add if title exists
      songs.push(song);
    }
  }

  return songs;
}

/**
 * Collect data from table
 */
function collectTableData() {
  const rows = songsTableBody.querySelectorAll('tr');
  const songs = [];
  const errors = [];
  const seenIds = new Set();

  rows.forEach((row, index) => {
    const songIdInput = row.querySelector('.song-id-input');
    const titleInput = row.querySelector('.title-input');
    const bpmInput = row.querySelector('.bpm-input');
    const timeSignatureInput = row.querySelector('.time-signature-input');

    const title = titleInput.value.trim();

    // Title is required
    if (!title) {
      errors.push(`Row ${index + 1}: Title is required`);
      return;
    }

    const song = { title };

    // Handle song_id
    if (manualSongIdToggle.checked) {
      const songIdValue = songIdInput.value.trim();
      if (!songIdValue) {
        errors.push(`Row ${index + 1}: Song ID is required when manual assignment is enabled`);
        return;
      }
      const songId = parseInt(songIdValue);
      if (isNaN(songId) || songId < 0) {
        errors.push(`Row ${index + 1}: Song ID must be a non-negative number`);
        return;
      }
      if (seenIds.has(songId)) {
        errors.push(`Row ${index + 1}: Duplicate Song ID ${songId}`);
        return;
      }
      seenIds.add(songId);
      song.song_id = songId;
    } else {
      // Auto-assign song ID
      song.song_id = index;
    }

    // Handle BPM (default to 120)
    const bpmValue = bpmInput.value.trim();
    if (bpmValue) {
      const bpm = parseInt(bpmValue);
      if (isNaN(bpm) || bpm <= 0 || bpm > 300) {
        errors.push(`Row ${index + 1}: BPM must be between 1 and 300`);
        return;
      }
      song.bpm = bpm;
    } else {
      song.bpm = 120; // Default
    }

    // Handle time signature (default to 4/4)
    const timeSignatureValue = timeSignatureInput.value.trim();
    if (timeSignatureValue) {
      // Validate time signature format
      const parts = timeSignatureValue.split('/');
      if (parts.length !== 2) {
        errors.push(`Row ${index + 1}: Time signature must be in format like 4/4, 3/4, or 6/8`);
        return;
      }
      const numerator = parseInt(parts[0]);
      const denominator = parseInt(parts[1]);

      if (isNaN(numerator) || isNaN(denominator) || numerator <= 0 || numerator > 32 || denominator <= 0 || denominator > 32) {
        errors.push(`Row ${index + 1}: Time signature numerator and denominator must be between 1 and 32`);
        return;
      }

      const validDenominators = [1, 2, 4, 8, 16, 32];
      if (!validDenominators.includes(denominator)) {
        errors.push(`Row ${index + 1}: Time signature denominator must be 1, 2, 4, 8, 16, or 32`);
        return;
      }

      song.time_signature = timeSignatureValue;
    } else {
      song.time_signature = '4/4'; // Default
    }

    songs.push(song);
  });

  return { songs, errors };
}

/**
 * Handle form submission
 */
async function handleSubmit() {
  const { songs, errors } = collectTableData();

  // Hide previous validation errors
  validationError.classList.add('hidden');
  validationError.innerHTML = '';

  if (errors.length > 0) {
    validationError.innerHTML = `
      <strong>Please fix the following errors:</strong>
      <ul style="margin-top: 10px; padding-left: 20px; margin-bottom: 0;">
        ${errors.map(err => `<li>${err}</li>`).join('')}
      </ul>
    `;
    validationError.classList.remove('hidden');
    validationError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  if (songs.length === 0) {
    validationError.innerHTML = '<strong>Error:</strong> Please add at least one song';
    validationError.classList.remove('hidden');
    validationError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  try {
    loadingSpinner.classList.remove('hidden');
    submitBtn.disabled = true;

    await upsertSongs(songs);

    // Success - redirect to instrument setup
    window.location.href = 'setup-instruments.html';
  } catch (error) {
    loadingSpinner.classList.add('hidden');
    submitBtn.disabled = false;
    validationError.innerHTML = `<strong>Failed to save songs:</strong> ${error.message}`;
    validationError.classList.remove('hidden');
    validationError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
