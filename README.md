# Stem-Separated Dataset Playback Helper

A web-based tool designed to help musical ensembles create stem-separated audio datasets where each instrument is recorded as an individual track. This tool enables layered ensemble recording by providing synchronized click tracks and real-time playback of previously-recorded parts, allowing musicians to record separately while staying in perfect sync with the ensemble. Each musician records in a specific order—first with just the click track, then with earlier parts playing back—building up a complete, cohesive performance one instrument at a time. The result is a professionally-organized dataset where every song has separate, aligned stems for each instrument, complete with metadata, multiple takes per instrument, and precise timing control. Perfect for creating training datasets for machine learning models, audio source separation research, or building multitrack libraries for remixing and analysis.

> **📋 This is a Public Template Repository**
>
> This repository contains NO actual credentials - it's a template for others to use.
> To use this tool:
> 1. Click "Use this template" to create your own **private** repository
> 2. Add your Supabase credentials to your private repo
> 3. Deploy from your private repo to GitHub Pages
>
> This keeps your credentials private while allowing your ensemble to use the tool!

## Features

- 🎵 **Click Track Generation** - Automatic metronome at song-specific BPMs and time signatures
- 🎚️ **Stem Playback & Mixing** - Play back previous recordings with independent volume control
- 🎭 **Multiple Takes Support** - Record and manage different versions for each instrument
- 🔄 **Take Selection** - Choose which take to hear in the mixer for each instrument
- ⚙️ **Offset Alignment** - Sync stems precisely with the click track (per-take)
- 📊 **Progress Tracking** - Monitor completion across all songs and instruments
- ☁️ **Cloud Storage Integration** - Direct audio file upload to Supabase Storage
- 👥 **Team Collaboration** - Shared progress via Supabase database

## How It Works

### Recording Process

Each instrument in your ensemble records in a specific order:

1. **First Instrument** records with only the click track
2. **Second Instrument** records with click track + first instrument playback
3. **Third Instrument** records with click track + first two instruments
4. Continue until all instruments have recorded for every song

This layered approach creates cohesive ensemble performances even when recording separately.

## Setup Instructions

This repository is a **public template**. To use it for your ensemble:

### Prerequisites

- GitHub account
- [Supabase](https://supabase.com) account (free tier works great)
- Google Drive for hosting WAV files
- Modern web browser (Chrome, Firefox, Safari, or Edge)

### Recommended Approach: Use Template for Private Deployment

This keeps your credentials private while allowing others to use the template:

### Step 1: Create Your Own Repo from Template

1. Click the **"Use this template"** button at the top of this GitHub repo
2. Select **"Create a new repository"** from the dropdown menu
3. Choose a name (e.g., "my-ensemble-playback")
4. **Set visibility to Private** (keeps your credentials private)
5. Click **"Create repository from template"**
6. Clone your new private repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/my-ensemble-playback.git
   cd my-ensemble-playback
   ```

### Step 2: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click **"New Project"**
3. Choose an organization (or create one)
4. Enter project details:
   - **Name**: e.g., "Real Book Dataset"
   - **Database Password**: Choose a strong password (save it somewhere safe)
   - **Region**: Choose closest to your team
5. Click **"Create new project"** and wait for provisioning (~2 minutes)

### Step 3: Set Up Database Schema

1. In your Supabase project dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy and paste this SQL schema:

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
  bpm INTEGER NOT NULL,
  time_signature TEXT DEFAULT '4/4'
);

-- Create stems table with takes support
CREATE TABLE stems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id INTEGER REFERENCES songs(song_id) ON DELETE CASCADE,
  instrument_id INTEGER REFERENCES instruments(instrument_id) ON DELETE CASCADE,
  take TEXT NOT NULL,
  wav_url TEXT NOT NULL,
  offset_seconds REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(song_id, instrument_id, take)
);

-- Create settings table for passwords and configuration
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_stems_song_id ON stems(song_id);
CREATE INDEX idx_stems_instrument_id ON stems(instrument_id);
CREATE INDEX idx_stems_take ON stems(song_id, instrument_id, take);

-- Enable Row Level Security (RLS)
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stems ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (allow all operations for your ensemble)
-- Since each ensemble has their own Supabase project, we allow all operations

-- Instruments policies
CREATE POLICY "Enable all operations for instruments" ON instruments
  FOR ALL USING (true) WITH CHECK (true);

-- Songs policies
CREATE POLICY "Enable all operations for songs" ON songs
  FOR ALL USING (true) WITH CHECK (true);

-- Stems policies
CREATE POLICY "Enable all operations for stems" ON stems
  FOR ALL USING (true) WITH CHECK (true);

-- Settings policies
CREATE POLICY "Enable all operations for settings" ON settings
  FOR ALL USING (true) WITH CHECK (true);
```

4. Click **"Run"** to execute the SQL
5. You should see "Success. No rows returned" - this is expected!

**About Row Level Security (RLS):** RLS is enabled with permissive policies that allow all operations. Since each ensemble has their own isolated Supabase project, this is safe. RLS ensures that security policies are enforced and gives you flexibility to add restrictions later if needed.

### Step 4: Create Storage Bucket for WAV Files

1. In your Supabase project dashboard, go to **Storage** (left sidebar)
2. Click **"New bucket"**
3. Set the bucket name to: `wav-files`
4. Toggle **"Public bucket"** to **ON** (this allows the website to access uploaded WAV files)
5. Toggle **"Restrict MIME Types"** to **ON**
   - Set "Allowed MIME types" to: `audio/wav`
6. Click **"Create bucket"**

**Why public?** WAV files need to be publicly accessible for the web audio player to load them. Since this is your ensemble's private project, only people with your Supabase credentials can upload files, and the files themselves are not discoverable (URLs are only stored in your database).

7. **Set up Storage Policies** - Go back to **SQL Editor** and run this:

```sql
-- Storage policies for wav-files bucket
-- These allow the website to upload, read, and delete WAV files

-- Allow public to read files
CREATE POLICY "Public can read wav files" ON storage.objects
  FOR SELECT USING (bucket_id = 'wav-files');

-- Allow public to upload files
CREATE POLICY "Public can upload wav files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'wav-files');

-- Allow public to delete files
CREATE POLICY "Public can delete wav files" ON storage.objects
  FOR DELETE USING (bucket_id = 'wav-files');

-- Allow public to update files
CREATE POLICY "Public can update wav files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'wav-files');
```

8. Click **"Run"** - You should see "Success. No rows returned"

### Step 5: Configure Supabase Credentials

1. **Get your Project URL:**
   - In Supabase dashboard, click **Project Settings** (gear icon in left sidebar)
   - Go to **Data API** section
   - Copy the **Project URL** (looks like: `https://xxxxx.supabase.co`)

2. **Get your Anon Key:**
   - Still in **Project Settings**, go to **API Keys** section
   - Expand **Legacy anon, service_role API keys**
   - Copy the **anon public** key (long JWT string starting with `eyJ...`)
   - ⚠️ **Do NOT copy the service_role key** - that one is actually sensitive!

3. **Create your config file:**
   ```bash
   cd src/js
   cp config.js.example config.js
   ```

4. **Remove config.js from .gitignore:**
   - Open `.gitignore` in your code editor
   - Remove or comment out the line: `src/js/config.js`
   - This allows you to commit your credentials to your **private** repo (which is safe since the repo is private)

5. Open `src/js/config.js` in your code editor
6. Replace the placeholder values with your actual credentials:

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-public-key-here';
```

⚠️ **Understanding Credentials & Privacy:**

**This repo is a public template with NO real credentials committed.**

When you create your **private** deployment repo:
- ✅ You add YOUR real credentials to `config.js`
- ✅ Commit them to your **PRIVATE** repo
- ✅ Deploy to GitHub Pages from **private** repo
- ✅ Your source code with credentials stays private in GitHub
- ⚠️ The deployed site is public (credentials visible in browser - this is unavoidable for static sites)

**This approach means:**
- ✅ This public template has no credentials exposed
- ✅ Each ensemble creates their own private deployment repo
- ✅ No risk of accidentally using someone else's database
- ✅ Clean separation between template and deployment

**Team collaboration:**
- All YOUR team members should use the SAME private repo and credentials
- Each DIFFERENT ensemble creates their own private repo with their own Supabase project

### Step 6: Deploy to GitHub Pages (from your Private Repo)

1. **Commit everything including config.js:**
   ```bash
   git add .
   git commit -m "Add Supabase configuration"
   git push
   ```

2. **Enable GitHub Pages:**
   - Go to your **private** repository on GitHub
   - Click **Settings** → **Pages** (left sidebar)
   - Under **"Source"**:
     - Branch: `main` (or `master`)
     - Folder: `/src`
   - Click **"Save"**
   - Wait ~1 minute for deployment
   - Access your site at: `https://YOUR_USERNAME.github.io/REPO_NAME/`

⚠️ **Important Notes:**
- Your **repository** is private (credentials not visible in GitHub)
- Your **deployed site** is public (anyone with the URL can use it)
- The credentials ARE visible in browser dev tools when visiting the site (this is unavoidable for static sites)
- This is fine - Supabase `anon` keys are designed for client-side use

### Step 6b: Local Testing (Recommended!)

Test locally before deploying to make sure everything works:

```bash
# Using Python 3
cd src
python3 -m http.server 8000

# Or using Node.js
cd src
npx http-server

# Or using PHP
cd src
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser. You can use the full site locally!

### Step 7: Prepare Your Song List CSV

Create a CSV file with your song list. Your CSV must include these columns (additional columns are allowed and will be ignored):

```csv
song_id,title,bpm,time_signature
1,Autumn Leaves,120,4/4
2,Blue Bossa,128,4/4
3,Giant Steps,286,4/4
4,,140,3/4
```

**Column Requirements:**
- `song_id` - Unique numeric identifier (required)
- `bpm` - Beats per minute (required, must be a number)
- `time_signature` - Time signature like 4/4, 3/4, 6/8, etc. (required, must not be empty)
- `title` - Song title (optional, can be empty)

**Note:** Your CSV can have additional columns (e.g., `artist`, `year`, `key`) - they will be ignored. Only `song_id`, `bpm`, `time_signature`, and `title` are extracted.

### Step 8: You're Done with Setup!

You're now ready to use the website:
1. Navigate to your deployed GitHub Pages URL (or `localhost:8000` for testing)
2. Set up passwords for website access and admin reset
3. Upload your songs CSV
4. Configure your instruments
5. Start uploading WAV files directly through the interface!

**About WAV File Storage:**
- WAV files are uploaded directly through the website to your Supabase Storage bucket
- No need for external hosting (Dropbox, Google Drive, etc.)
- Files are automatically stored and managed
- You can download all data (songs, stems, and WAV files) as a ZIP using the "Download Data" button

## Using the Website

### Password System

This website uses two passwords to protect your data and control access:

**1. Website Password**
- Required to access the website
- Share this with all ensemble members who need to view songs and add stems
- Anyone with the website link will see a login page where they enter this password
- Stored in browser session (re-enter after closing browser)
- **Security:** After 5 failed login attempts, the page locks for 15 minutes

**2. Admin Password**
- Required for administrative actions: adding new songs, deleting songs, deleting stems, and resetting all data
- Only share with trusted administrators
- Keep this secure - it allows complete control over the dataset
- **Security:** After 5 failed attempts, the admin function locks for 15 minutes

**Password Setup:**
- After initial deployment, the first page will prompt you to set both passwords
- These are stored in the `settings` table in your Supabase database
- To change passwords later, you can update the database directly or reset all data

### Initial Setup (First Time)

1. **Welcome Page** - Read about the recording process and click Continue
2. **Password Setup** - Set website password (for access) and admin password (for reset)
3. **Upload Songs** - Upload your CSV file with song metadata
4. **Setup Instruments** - Add your instruments IN RECORDING ORDER
5. **Song List** - Main page with all songs and progress tracking

### Accessing the Website (After Setup)

When you or your ensemble members visit the website:
1. **Login Page** - Enter the website password
2. **Song List** - Redirected to the main page after successful login

### Recording Workflow

1. Navigate to a song from the song list
2. Click **"Edit Stems"**
3. Select the instrument you're adding
4. Click **"Choose File"** and select your WAV file from your computer
5. Click **"Upload & Load WAV File"**
6. Wait for upload to complete (progress bar will show status)
7. Listen to the preview with click track
8. Adjust the offset slider to align with the click track
   - **Negative offset** = add silence before the audio
   - **Positive offset** = trim from the start
9. Click **"Save"** when aligned correctly
10. Return to song list to see updated progress

**Note:** WAV files are uploaded to your Supabase Storage bucket. You can download all your data later using the "Download Data" button on the song list page.

### Playback for Recording

1. Open a song
2. Toggle **Click Track** and **Count-In** as needed
3. Adjust volume sliders for each stem (or mute them)
4. Click **Play** to hear the mix
5. Record your part while listening!

## Troubleshooting

### "Error uploading audio file" or Storage errors

**Possible causes:**
- Storage bucket "wav-files" not created
- Storage bucket not set to public
- File is not a valid WAV format
- File size too large for free tier limits

**Solutions:**
- Go to Supabase Dashboard → Storage
- Verify the "wav-files" bucket exists and is set to public
- Ensure file is actually a WAV file (not MP3 or other format)
- Check Supabase free tier limits (5GB storage on free tier)

### "Supabase credentials not configured" warning

- Open `src/js/config.js`
- Make sure you replaced `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`
- Check for typos in the credentials

### Changes not showing after deployment

- GitHub Pages can take a few minutes to update
- Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Check that you pushed the latest changes to GitHub

### Audio clicks or pops during playback

- This can happen with offset adjustments
- Try adjusting the offset by small increments (0.01s)
- Ensure your WAV files have proper fade-ins/outs

### Website works locally but not on GitHub Pages

- Check that all file paths are relative (not absolute)
- Verify Supabase credentials are correct in the deployed version
- Check browser console for errors (F12 → Console tab)

## Exporting Data

### Easy Export with Download Button

The simplest way to export all your data is using the **"Download Data"** button on the song list page:

1. Go to the main song list page
2. Click **"📥 Download Data"** (next to "Reset Everything")
3. Wait for the download to complete (progress modal will show status)
4. A ZIP file will be downloaded containing:
   - **songs.csv** - All song metadata (ID, title, BPM)
   - **instruments.csv** - All instruments with recording order
   - **stems.csv** - Complete stem data with offsets, instrument names, and WAV URLs
   - **wav_files/** folder - All uploaded WAV files

This ZIP contains everything you need for downstream processing!

### Manual Export from Supabase (Alternative)

You can also export data directly from Supabase if needed:

1. Go to your Supabase project dashboard
2. Click **SQL Editor**
3. Run this query:

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

4. Click the **"Download as CSV"** button

## Architecture

### Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 modules)
- **Audio**: Web Audio API
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (WAV files)
- **Deployment**: GitHub Pages (static hosting)
- **ZIP Generation**: JSZip library

### Database Schema

```
instruments
├─ instrument_id (PK, auto-increment)
├─ instrument_name
└─ order_index (unique, 0-based)

songs
├─ song_id (PK)
├─ title (nullable)
└─ bpm

stems
├─ id (PK, UUID)
├─ song_id (FK → songs)
├─ instrument_id (FK → instruments)
├─ take (TEXT, NOT NULL)
├─ wav_url
├─ offset_seconds
├─ created_at
└─ updated_at

Unique constraint: (song_id, instrument_id, take)
```

### Why This Architecture?

- **No server needed** - Everything runs client-side via GitHub Pages
- **Easy to fork** - Each ensemble creates their own instance
- **Free** - GitHub Pages and Supabase free tiers are generous
- **Scalable** - Can handle hundreds of songs and instruments
- **Portable data** - Export to CSV anytime for other tools

## Browser Compatibility

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Requirements:**
- JavaScript enabled
- Web Audio API support (all modern browsers)
- ES6 module support

## Contributing

If you find bugs or have feature requests, please open an issue on GitHub!

Common improvements:
- Waveform-based visual alignment
- Real-time collaboration features
- Export mixed stems as final audio
- Mobile/tablet optimization
- Additional audio format support

## License

This project is open source. Feel free to modify and adapt for your needs!

## Credits

Built for musicians recording stem-separated datasets with layered ensemble performances.

---

## Quick Reference

### Key Files

- `src/index.html` - Welcome page
- `src/upload-songs.html` - CSV upload
- `src/setup-instruments.html` - Instrument ordering
- `src/song-list.html` - Main song list
- `src/song-detail.html` - Playback and stem management
- `src/js/config.js.example` - **Template for Supabase config (copy to config.js)**
- `src/js/config.js` - **Your Supabase credentials (create from template)**
- `src/js/db.js` - Database functions
- `src/js/audio.js` - Audio processing
- `src/css/styles.css` - Styling

### Useful Commands

```bash
# Test locally
cd src && python3 -m http.server 8000

# Push changes to GitHub
git add .
git commit -m "Update message"
git push

# Export Supabase data
# Use SQL Editor in Supabase dashboard
```

### Important Links

- [Supabase Documentation](https://supabase.com/docs)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

---

**Need help?** Open an issue on GitHub or check the troubleshooting section above.

Happy recording! 🎵
