# Implementation Plan: Stem-Separated Dataset Playback Helper

## Overview
A web-based tool to help musicians record stem-separated datasets. The website provides click tracks and playback of previously-recorded stems, with shared progress tracking across the ensemble via Supabase.

## Technology Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Audio**: Web Audio API
- **Backend/Persistence**: Supabase (PostgreSQL database with REST API)
- **Deployment**: GitHub Pages
- **Audio Storage**: Google Drive (direct download links)

## Project Structure
```
playback_helper/
├── README.md                          # Setup instructions and documentation
├── .env.example                       # Template for environment variables
├── .gitignore                         # Ignore .env file
└── src/
    ├── index.html                     # Welcome page
    ├── upload-songs.html              # CSV upload page
    ├── setup-instruments.html         # Instrument ordering page
    ├── song-list.html                 # Main song list/homepage
    ├── song-detail.html               # Individual song playback page
    ├── css/
    │   └── styles.css                 # Global styles
    ├── js/
    │   ├── config.js                  # Supabase configuration
    │   ├── db.js                      # Supabase database functions
    │   ├── audio.js                   # Web Audio API utilities
    │   ├── gdrive-utils.js            # Google Drive link conversion
    │   ├── upload-songs.js            # Song CSV upload logic
    │   ├── setup-instruments.js       # Instrument setup logic
    │   ├── song-list.js               # Song list view logic
    │   └── song-detail.js             # Song detail/playback logic
    └── assets/
        └── click.wav                  # Click track sound file
```

## Supabase Database Schema

Each Supabase deployment represents one ensemble/project. No need for a projects table since each fork gets its own Supabase instance.

### Table: `instruments`
Stores the ensemble's instruments in recording order.
```sql
CREATE TABLE instruments (
  instrument_id SERIAL PRIMARY KEY,
  instrument_name TEXT NOT NULL,
  order_index INTEGER NOT NULL UNIQUE  -- 0 for first, 1 for second, etc.
);
```

### Table: `songs`
Stores song metadata from the uploaded CSV.
```sql
CREATE TABLE songs (
  song_id INTEGER PRIMARY KEY,
  title TEXT,
  bpm INTEGER NOT NULL
);
```

### Table: `stems`
Stores stem recordings with offsets.
```sql
CREATE TABLE stems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id INTEGER REFERENCES songs(song_id) ON DELETE CASCADE,
  instrument_id INTEGER REFERENCES instruments(instrument_id) ON DELETE CASCADE,
  wav_url TEXT NOT NULL,
  offset_seconds REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(song_id, instrument_id)
);
```

### Indexes
```sql
CREATE INDEX idx_stems_song_id ON stems(song_id);
CREATE INDEX idx_stems_instrument_id ON stems(instrument_id);
```

### Row Level Security (RLS)
```sql
-- Enable RLS on all tables
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stems ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (allow all operations)
CREATE POLICY "Enable all operations for instruments" ON instruments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for songs" ON songs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for stems" ON stems
  FOR ALL USING (true) WITH CHECK (true);
```

## Page-by-Page Implementation

### 1. Welcome Page (`index.html`)
**Purpose**: Introduction and explanation of the recording process.

**Content**:
- Title: "Stem-Separated Dataset Playback Helper"
- Explanation of what the website is for
- Description of the recording process:
  - Instrument 1 records with click track
  - Instrument 2 records with click track + Instrument 1 playback
  - Instrument 3 records with click track + Instruments 1-2 playback
  - Continue until all instruments are recorded
- "Continue" button → navigates to `upload-songs.html`

**JavaScript**: None required (static page).

---

### 2. Song Upload Page (`upload-songs.html`)
**Purpose**: Upload CSV with song metadata.

**UI Components**:
- Instructions explaining CSV format: `song_id,title,bpm`
- File upload input (accepts `.csv`)
- Preview table showing parsed CSV data
- Validation messages (e.g., "Missing BPM for song_id 5")
- "Next" button → navigates to `setup-instruments.html`

**JavaScript (`upload-songs.js`)**:
- Parse CSV using FileReader API
- Validate:
  - Required columns: `song_id`, `bpm`
  - Each `song_id` must have a non-null `bpm`
  - `song_id` must be numeric
  - `title` is optional
- Store parsed data in Supabase `songs` table
- On success, proceed to instrument setup

**Functions**:
```javascript
async function parseCSV(file)
async function validateSongData(rows)
async function uploadSongsToSupabase(songs)
```

---

### 3. Instrument Setup Page (`setup-instruments.html`)
**Purpose**: Define instrument order for ensemble.

**UI Components**:
- Input field to add instrument name
- "Add Instrument" button
- Ordered list view showing instruments with indices (1, 2, 3, ...)
- Remove buttons for each instrument
- Up/Down buttons to reorder
- Explanation of recording process (same as welcome page)
- "Next" button → navigates to `song-list.html`

**JavaScript (`setup-instruments.js`)**:
- Add/remove/reorder instruments in a local array
- Display numbered list with visual indices
- Save instruments to Supabase `instruments` table (one row per instrument with order_index)

**Functions**:
```javascript
async function saveInstrumentsToSupabase(instruments)
function addInstrument(name)
function removeInstrument(index)
function moveInstrument(fromIndex, toIndex)
```

---

### 4. Song List Page (`song-list.html`)
**Purpose**: Main homepage showing all songs with progress tracking.

**UI Components**:
- Progress bar showing completion percentage
  - Formula: `(total_stems_added / (num_songs × num_instruments)) × 100`
- Search box to filter by `song_id`
- "Reset Everything" button (with confirmation dialog)
- Grid/list of song cards, each showing:
  - `song_id: title` (or just `song_id` if no title)
  - `BPM: {bpm}`
  - Mini progress indicator (e.g., "3/5 stems")
  - Click to navigate to `song-detail.html?song_id={song_id}`

**JavaScript (`song-list.js`)**:
- Fetch all songs from Supabase
- Fetch stem counts per song
- Calculate and display progress bar
- Implement search/filter functionality
- Handle "Reset Everything" (delete all data, redirect to welcome)

**Functions**:
```javascript
async function fetchSongs()
async function fetchStemCounts()
function calculateProgress(stemCounts, totalSongs, totalInstruments)
function filterSongs(searchTerm)
async function resetEverything()
```

---

### 5. Song Detail Page (`song-detail.html`)
**Purpose**: Playback interface for recording with click track and existing stems.

**URL**: `song-detail.html?song_id={song_id}`

**UI Components**:

#### Header Section
- Title: `{song_id}: {title}` or just `{song_id}`
- Subtitle: `BPM: {bpm}`

#### Playback Controls
- **Click Track Toggle**: On/Off
- **Count-In Toggle**: On/Off (4 beats before playback)
- **Stem Mixer**: For each available stem:
  - Instrument name
  - Volume slider (0% to 100%)
  - Mute button (syncs with slider)

#### Playback Section
- **Play/Pause Button**
- **Reset Button** (restart from beginning)
- **Waveform Visualization** (canvas element showing mix amplitude)
- Real-time playback position indicator

#### Edit Stems Section
- **"Edit Stems" Button** → Opens modal

**Modal: Edit/Add Stem**
- List of all instruments in ensemble
- Click instrument → Opens add/edit view:
  - If stem exists: Pre-fill URL and offset (edit mode)
  - If stem doesn't exist: Empty fields (add mode)

**Add/Edit Stem View**:
- Text input for Google Drive share link
- "Load WAV" button (converts link, fetches audio)
- Playback controls (Play/Pause, Reset) with click track overlay
- Offset slider (default range: -5 to 5 seconds)
  - Auto-expand range if saved offset is outside bounds
- Text input for precise offset entry
- Explanation: "Align your stem so the song start (excluding pickup) begins on the lowest bar number, on beat 1"
- "Save" button → Store to Supabase, close modal
- "Cancel" button → Discard changes, close modal

**JavaScript (`song-detail.js`)**:
- Fetch song metadata and existing stems from Supabase
- Mix audio using Web Audio API:
  - Generate click track (metronome sound at BPM)
  - Generate count-in (4 beats)
  - Mix stems with volume levels
  - Apply offsets (negative = zero-pad front, positive = trim start)
- Visualize waveform on canvas
- Handle stem upload, offset adjustment, and saving

**Functions**:
```javascript
async function fetchSongData(songId)
async function fetchStems(songId)
async function fetchInstruments()
async function loadWavFromUrl(url)
function generateClickTrack(bpm, durationSeconds)
function generateCountIn(bpm)
function mixAudio(stems, clickTrack, countIn, volumes, offsets)
function drawWaveform(audioBuffer, canvas)
function applyOffset(audioBuffer, offsetSeconds)
async function saveStem(songId, instrumentId, wavUrl, offset)
```

---

## Key Utilities

### Google Drive Link Conversion (`gdrive-utils.js`)
Converts Google Drive share links to direct download URLs.

```javascript
/**
 * Extracts file ID from Google Drive share link and converts to direct download URL.
 * Input: https://drive.google.com/file/d/1ABC123xyz/view?usp=sharing
 * Output: https://drive.google.com/uc?export=download&id=1ABC123xyz
 */
function convertGDriveLink(shareUrl) {
  // Extract file ID using regex
  const match = shareUrl.match(/\/d\/([^\/]+)/);
  if (!match) {
    throw new Error('Invalid Google Drive link');
  }
  const fileId = match[1];
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
```

### Audio Utilities (`audio.js`)
Web Audio API helpers for mixing and playback.

```javascript
// Create AudioContext (reuse across page)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Load WAV from URL
async function loadAudioBuffer(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

// Generate click track
function createClickTrack(bpm, durationSeconds) {
  // Create metronome pulse using oscillator
  // Return AudioBuffer
}

// Apply offset (zero-pad or trim)
function applyOffsetToBuffer(buffer, offsetSeconds) {
  // Negative: prepend silence
  // Positive: trim from start
  // Return new AudioBuffer
}

// Mix multiple buffers with volume levels
function mixBuffers(buffers, volumes) {
  // Mix down to stereo
  // Apply volume scaling
  // Return combined AudioBuffer
}

// Visualize waveform
function drawWaveformToCanvas(buffer, canvas) {
  // Draw amplitude envelope
}
```

### Database Functions (`db.js`)
Supabase CRUD operations.

```javascript
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Instruments
async function saveInstruments(instruments) {
  // Delete all existing instruments first
  await supabase.from('instruments').delete().neq('instrument_id', 0);

  // Insert new instruments with order
  const instrumentRows = instruments.map((name, index) => ({
    instrument_name: name,
    order_index: index
  }));

  const { data, error } = await supabase
    .from('instruments')
    .insert(instrumentRows)
    .select();
  return data;
}

async function getAllInstruments() {
  const { data } = await supabase
    .from('instruments')
    .select('*')
    .order('order_index');
  return data;
}

// Songs
async function upsertSongs(songs) {
  const { error } = await supabase
    .from('songs')
    .upsert(songs, { onConflict: 'song_id' });
}

async function getAllSongs() {
  const { data } = await supabase
    .from('songs')
    .select('*')
    .order('song_id');
  return data;
}

async function getSong(songId) {
  const { data } = await supabase
    .from('songs')
    .select('*')
    .eq('song_id', songId)
    .single();
  return data;
}

// Stems
async function getStemsBySong(songId) {
  const { data } = await supabase
    .from('stems')
    .select('*, instruments(*)')
    .eq('song_id', songId)
    .order('instruments(order_index)');
  return data;
}

async function upsertStem(songId, instrumentId, wavUrl, offsetSeconds) {
  const { data, error } = await supabase
    .from('stems')
    .upsert({
      song_id: songId,
      instrument_id: instrumentId,
      wav_url: wavUrl,
      offset_seconds: offsetSeconds,
      updated_at: new Date().toISOString()
    }, { onConflict: 'song_id,instrument_id' });
  return data;
}

async function getAllStems() {
  const { data } = await supabase
    .from('stems')
    .select('*');
  return data;
}

// Reset
async function deleteAllData() {
  // Cascade delete handles stems when songs/instruments are deleted
  await supabase.from('stems').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('songs').delete().neq('song_id', 0);
  await supabase.from('instruments').delete().neq('instrument_id', 0);
}
```

### Configuration (`config.js`)
Load environment variables (Supabase credentials).

```javascript
// These will be set via environment variables or hardcoded after deployment
export const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
```

**Note**: For GitHub Pages, we'll use a build step or manual replacement to inject credentials from `.env` file.

---

## Data Persistence Flow

### Initial Setup (First-time user):
1. User completes welcome page
2. User uploads CSV → Stores rows in Supabase `songs` table
3. User defines instruments → Stores rows in Supabase `instruments` table with order_index

### Adding Stems:
1. User navigates to song detail page
2. Clicks "Edit Stems" → Select instrument
3. Pastes Google Drive share link → Convert to direct download URL
4. Adjusts offset while previewing with click track
5. Clicks "Save" → Upsert to `stems` table with (song_id, instrument_id, wav_url, offset_seconds)
6. Song list page automatically reflects updated progress

### Team Collaboration:
- All team members use the same Supabase project (same credentials)
- Changes are immediately visible across all devices
- No manual sync required

---

## README.md Structure

The README should include:

### 1. **Project Description**
- What this website is for (stem-separated dataset recording helper)
- Target users (musicians/ensembles recording stem-separated datasets)

### 2. **Features**
- Click track generation at song-specific BPMs
- Playback of previously-recorded stems with volume control
- Offset alignment for synchronization
- Team progress tracking
- Google Drive integration for audio storage

### 3. **Setup Instructions for Forking**

#### Prerequisites
- GitHub account
- Supabase account (free tier)
- Google Drive for hosting WAV files

#### Step-by-Step Setup

**Step 1: Fork the Repository**
```bash
# Fork on GitHub, then clone
git clone https://github.com/YOUR_USERNAME/playback_helper.git
cd playback_helper
```

**Step 2: Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Wait for provisioning
4. Get credentials:
   - Project Settings > Data API > Copy **Project URL**
   - Project Settings > API Keys > Legacy anon, service_role API keys > Copy **anon public** key

**Step 3: Set Up Database Schema**
1. In Supabase dashboard, go to SQL Editor
2. Run the following SQL:
```sql
-- Create instruments table
CREATE TABLE instruments (
  instrument_id SERIAL PRIMARY KEY,
  instrument_name TEXT NOT NULL,
  order_index INTEGER NOT NULL UNIQUE
);

-- Create songs table
CREATE TABLE songs (
  song_id INTEGER PRIMARY KEY,
  title TEXT,
  bpm INTEGER NOT NULL
);

-- Create stems table
CREATE TABLE stems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id INTEGER REFERENCES songs(song_id) ON DELETE CASCADE,
  instrument_id INTEGER REFERENCES instruments(instrument_id) ON DELETE CASCADE,
  wav_url TEXT NOT NULL,
  offset_seconds REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(song_id, instrument_id)
);

-- Create indexes
CREATE INDEX idx_stems_song_id ON stems(song_id);
CREATE INDEX idx_stems_instrument_id ON stems(instrument_id);

-- Enable Row Level Security (RLS)
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stems ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (allow all operations)
CREATE POLICY "Enable all operations for instruments" ON instruments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for songs" ON songs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for stems" ON stems
  FOR ALL USING (true) WITH CHECK (true);
```

**Step 4: Configure Environment Variables**
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and add your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Update `src/js/config.js` with your credentials (for GitHub Pages deployment)

**Step 5: Enable CORS in Supabase**
- By default, Supabase allows all origins
- If restricted, add your GitHub Pages URL

**Step 6: Deploy to GitHub Pages**
1. Go to repository Settings → Pages
2. Source: Deploy from `main` branch, `/src` folder
3. Save and wait for deployment
4. Access at `https://YOUR_USERNAME.github.io/playback_helper/`

**Step 7: Prepare Google Drive Audio Files**
1. Upload WAV files to Google Drive
2. Right-click → Share → Anyone with link can view
3. Copy share link
4. Website will automatically convert to direct download format

### 4. **Usage Guide**
- How to upload song CSV
- How to set up instruments
- How to add stems
- Best practices for offset alignment

### 5. **Exporting Data**
- How to access Supabase dashboard
- Export stems data as CSV for downstream processing:
  ```sql
  SELECT
    s.song_id,
    i.order_index as instrument_order,
    i.instrument_name,
    s.wav_url,
    s.offset_seconds
  FROM stems s
  JOIN instruments i ON s.instrument_id = i.instrument_id
  ORDER BY s.song_id, i.order_index;
  ```

### 6. **Troubleshooting**
- Google Drive CORS issues
- Audio playback problems
- Supabase connection errors

---

## Implementation Phases

### Phase 1: Core Setup
- [ ] Create project structure
- [ ] Set up Supabase schema
- [ ] Create `.env.example` file
- [ ] Write README.md with setup instructions

### Phase 2: Page Development
- [ ] Welcome page (static)
- [ ] Song upload page + CSV parsing
- [ ] Instrument setup page
- [ ] Song list page with progress tracking

### Phase 3: Audio Playback
- [ ] Song detail page UI
- [ ] Web Audio API integration
- [ ] Click track generation
- [ ] Stem mixing with volume controls

### Phase 4: Stem Management
- [ ] Edit Stems modal
- [ ] Google Drive link conversion
- [ ] Offset adjustment with preview
- [ ] Save/update stems to Supabase

### Phase 5: Polish
- [ ] Waveform visualization
- [ ] Responsive CSS styling
- [ ] Error handling and validation
- [ ] Cross-browser testing

### Phase 6: Deployment
- [ ] GitHub Pages setup
- [ ] Documentation finalization
- [ ] Team testing

---

## Technical Considerations

### Browser Compatibility
- Web Audio API: Chrome, Firefox, Safari, Edge (all modern versions)
- Fetch API: Universal support
- ES6 Modules: Use for clean code organization

### Performance
- Lazy load WAV files (only when needed)
- Cache AudioBuffers in memory during session
- Debounce offset slider to avoid excessive re-renders

### Security
- Supabase Row Level Security (RLS) policies:
  - For open collaboration: Allow all reads/writes (default)
  - For restricted access: Add authentication (optional future enhancement)

### Error Handling
- Network failures (Supabase down, Google Drive inaccessible)
- Invalid CSV uploads
- Corrupted WAV files
- Browser incompatibility warnings

---

## Future Enhancements (Optional)
- User authentication for private ensembles
- Real-time collaboration (live updates via Supabase Realtime)
- Waveform-based visual alignment tool
- Export mixed stems as final recordings
- Backup/restore project configuration
- Mobile-responsive improvements for tablet recording setups

---

## Files to Create

1. `README.md` - Setup and usage documentation
2. `.env.example` - Template for Supabase credentials
3. `.gitignore` - Ignore `.env`
4. `src/index.html` - Welcome page
5. `src/upload-songs.html` - CSV upload
6. `src/setup-instruments.html` - Instrument setup
7. `src/song-list.html` - Song list/homepage
8. `src/song-detail.html` - Song detail/playback
9. `src/css/styles.css` - Global styles
10. `src/js/config.js` - Supabase config
11. `src/js/db.js` - Database functions
12. `src/js/audio.js` - Web Audio utilities
13. `src/js/gdrive-utils.js` - Google Drive link conversion
14. `src/js/upload-songs.js` - Upload page logic
15. `src/js/setup-instruments.js` - Instrument setup logic
16. `src/js/song-list.js` - Song list logic
17. `src/js/song-detail.js` - Song detail logic
18. `src/assets/click.wav` - Click track sound (or generate programmatically)

---

## Next Steps
1. Review and approve this implementation plan
2. Set up Supabase project and obtain credentials
3. Begin Phase 1 implementation
4. Iterate and test with ensemble members
