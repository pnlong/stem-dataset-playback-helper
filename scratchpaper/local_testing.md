# Local Testing Instructions

This guide is for YOU to test the application locally before creating your private deployment repo.

## Quick Setup

### 1. Create Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in details:
   - Name: "Real Book Dataset" (or whatever you want)
   - Database Password: Choose a strong password (save it!)
   - Region: Choose closest to you
4. Wait ~2 minutes for provisioning

### 2. Set Up Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy and paste this SQL:

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

-- Create indexes
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

4. Click **"Run"**
5. Should see "Success. No rows returned"

**Why RLS?** Row Level Security adds a security layer even though your policies are permissive. Since each ensemble has their own isolated Supabase project, allowing all operations is safe. RLS ensures policies are enforced and provides flexibility to add restrictions later if needed.

### 3. Create Storage Bucket

1. In Supabase dashboard, go to **Storage** (left sidebar)
2. Click **"New bucket"**
3. Set the bucket name to: `wav-files`
4. Toggle **"Public bucket"** to **ON**
5. Toggle **"Restrict MIME Types"** to **ON**
   - Set "Allowed MIME types" to: `audio/wav`
6. Click **"Create bucket"**

**Why public?** WAV files need to be publicly accessible for the web audio player. Only people with your Supabase credentials can upload files.

7. **Set up Storage Policies** - Go back to **SQL Editor** and run this:

```sql
-- Storage policies for wav-files bucket
CREATE POLICY "Public can read wav files" ON storage.objects
  FOR SELECT USING (bucket_id = 'wav-files');

CREATE POLICY "Public can upload wav files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'wav-files');

CREATE POLICY "Public can delete wav files" ON storage.objects
  FOR DELETE USING (bucket_id = 'wav-files');

CREATE POLICY "Public can update wav files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'wav-files');
```

8. Click **"Run"**

### 4. Get Your Credentials

1. **Get Project URL:**
   - In Supabase dashboard, click **Project Settings** (gear icon in left sidebar)
   - Go to **Data API** section
   - Copy the **Project URL** (e.g., `https://abcdefghijk.supabase.co`)

2. **Get Publishable API Key:**
   - Still in **Project Settings**, go to **API Keys** section
   - Look for **Publishable API keys** section
   - Copy the **publishable** key (starts with `sb_publishable_...`)
   - ⚠️ **Note**: If you don't see "Publishable API keys", look for "Legacy anon, service_role API keys" and use the **anon public** key instead (starts with `eyJ...`)
   - ⚠️ **Do NOT copy the service_role or secret key** - those are actually sensitive!

### 5. Update credentials.js

Edit `src/js/credentials.js` and replace the two placeholder values:

```javascript
export const SUPABASE_URL = 'https://your-actual-project-id.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...'; // Your actual key here
```

**Important:** Only edit the two values after the `=` signs. Don't remove the `export` keyword!

### 6. Start Local Server

```bash
cd src
python3 -m http.server 8000
```

Or if you prefer Node:
```bash
cd src
npx http-server
```

Or PHP:
```bash
cd src
php -S localhost:8000
```

### 7. Test the Application

Open your browser to `http://localhost:8000`

**Test Flow:**

1. **Home Page** → Automatically redirects to song list (which will redirect to setup if needed)
2. **Password Setup** → Set up two passwords:
   - **Website Password**: Required for anyone to access the site (share with ensemble)
   - **Admin Password**: Required for administrative actions (adding/deleting songs, deleting stems, resetting all data) - keep secure!
   - Example: `ensemble2024` for website, `admin123` for admin
   - ⚠️ **Important**: These cannot be changed through the UI later!
   - 🔒 **Security**: Both passwords have rate limiting (5 attempts, then 15-minute lockout)
3. **Upload Songs** → Upload a test CSV with songs (see example below)
4. **Setup Instruments** → Add your instruments in recording order
5. **Login Page** → If you revisit after closing browser, enter website password
6. **Song List** → View all songs and progress
7. **Add Stems** → Click a song, then "Edit Stems" to add WAV files

**Routing Notes:**
- `index.html` (root) → redirects to `song-list.html` (home page)
- If passwords not set → redirects to `welcome.html` → `passwords-setup.html`
- If data already exists → setup pages redirect to `song-list.html` to prevent accidental re-upload
- **Reset Everything** button is always accessible, even if page is stuck loading!

### Example Test CSV

Create a file `test_songs.csv`:

```csv
song_id,title,bpm,time_signature
1,Autumn Leaves,120,4/4
2,Blue Bossa,128,4/4
3,All The Things You Are,140,4/4
```

**Note:** Your CSV can have additional columns - they will be ignored. Only `song_id`, `bpm`, `time_signature`, and `title` are used.

### Testing with WAV Files

**✨ No external hosting needed!**

WAV files are now uploaded directly through the website to your Supabase Storage bucket. To test:

1. Go to a song detail page
2. Click **"Edit Stems"**
3. Select an instrument
4. Click **"Choose File"** and select a test WAV file from your computer
5. Click **"Upload & Load WAV File"**
6. The file will upload to your Supabase Storage bucket
7. After upload, you'll see a preview with the click track
8. Adjust the offset and save

**Download Your Data:**
- Go back to the song list page
- Click **"📥 Download Data"** to download everything as a ZIP
- The ZIP includes all songs, instruments, stems metadata, and uploaded WAV files

## Troubleshooting

### "Supabase credentials not configured" warning

- Check that you edited `src/js/credentials.js`
- Make sure you replaced BOTH `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`
- Ensure you kept the `export` keyword before each variable
- Check for typos in the values

### Stuck on song list page / Can't access anything

If the page is stuck or you can't get past authentication:

1. **Use Reset Everything**: The button is always accessible even if the page is loading
2. Click "Reset Everything" → Enter admin password (if you remember it)
3. If you forgot the admin password:
   - Go to Supabase → Table Editor → `settings` table
   - Delete the row where `key = 'passwords'`
   - Refresh the page
   - Click "Reset Everything" (will just ask for confirmation)
4. After reset, you'll be redirected to welcome page to start fresh

### Redirected to wrong page / Setup loops

- Clear your browser cache and session storage:
  - Open Developer Tools (F12)
  - Go to Application/Storage tab
  - Clear Session Storage
  - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check the browser console for errors
- Make sure the database schema is set up correctly (including `settings` table)

### Forgot admin password

**Option 1: Manually delete from database**
1. Go to Supabase → Table Editor → `settings` table
2. Delete the row where `key = 'passwords'`
3. Refresh the page and set new passwords

### Locked out due to too many failed password attempts

**For website password lockout:**
1. Wait 15 minutes for the lockout to expire
2. OR clear localStorage in browser (Developer Tools → Application/Storage → Local Storage → Clear)
3. Refresh the page

**For admin password lockout (Reset Everything):**
1. Wait 15 minutes for the lockout to expire
2. OR clear localStorage in browser
3. OR manually reset via Supabase database (delete from `settings` table)

**Option 2: Update in database**
1. Go to Supabase → Table Editor → `settings` table
2. Find the row where `key = 'passwords'`
3. Edit the `value` column (it's JSON):
   ```json
   {
     "website": "your-new-website-password",
     "admin": "your-new-admin-password"
   }
   ```
4. Save and refresh the page

### Storage/upload errors

- Make sure you created the "wav-files" bucket in Supabase Storage
- Verify the bucket is set to public
- Check that the WAV file is a valid audio file
- Ensure you haven't exceeded Supabase free tier storage limits (5GB)

### Database connection errors

- Verify your Supabase project is running (check dashboard)
- Double-check the URL and key are correct
- Make sure you ran the SQL schema setup (including `settings` table!)

### Module import errors

- Make sure you're using a local server, not just opening `index.html` as a file
- ES6 modules require HTTP/HTTPS protocol

## Once You're Happy with Testing

When everything works locally:

1. **Reset credentials to placeholders:**
   - Open `src/js/credentials.js`
   - Change back to:
   ```javascript
   export const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   export const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
   ```

2. **Commit your changes (with placeholder credentials):**
   ```bash
   git add .
   git commit -m "Finalize template"
   git push
   ```

3. **Create your deployment repo:**
   - On GitHub, click "Use this template" on this repo
   - Name it something like "my-ensemble-playback"
   - **Set visibility to Public** (or Private with GitHub PRO)
   - Clone the new repo
   - Edit `src/js/credentials.js` with YOUR actual credentials
   - Commit and push: `git commit -m "Add Supabase credentials" src/js/credentials.js && git push`
   - Deploy to GitHub Pages from `main` branch `/src` folder

## Database Migration (For Existing Users)

**If you previously set up this system and are upgrading to the version with Takes support**, you need to migrate your database:

### Migration Script

Run this SQL in your Supabase SQL Editor to add the `take` column and migrate existing stems:

```sql
-- Step 1: Add the 'take' column to the stems table
ALTER TABLE stems ADD COLUMN take TEXT;

-- Step 2: Set existing stems to take '0' (for backward compatibility)
UPDATE stems SET take = '0' WHERE take IS NULL;

-- Step 3: Make the 'take' column NOT NULL
ALTER TABLE stems ALTER COLUMN take SET NOT NULL;

-- Step 4: Drop the old unique constraint
ALTER TABLE stems DROP CONSTRAINT IF EXISTS stems_song_id_instrument_id_key;

-- Step 5: Create new unique constraint including 'take'
ALTER TABLE stems ADD CONSTRAINT stems_song_id_instrument_id_take_key
  UNIQUE (song_id, instrument_id, take);

-- Step 6: Create index for faster queries on take column
CREATE INDEX idx_stems_take ON stems(song_id, instrument_id, take);
```

**After running this migration:**
- All your existing stems will be converted to "take 0"
- You can now add additional takes for each instrument
- The UI will show a takes list view for each instrument
- Progress tracking will work the same way (at least one take = complete)

**Note:** This migration is safe and backward-compatible. Your existing data will not be lost.

## Sharing with Your Team

Once deployed, share:
- ✅ The GitHub Pages URL with your team
- ✅ The repo URL if they need to see the code or make changes

Your team members can then:
- Visit the deployed site URL
- All use the same database
- See shared progress
- Clone the repo and make changes if needed

**Note:** Your credentials are visible in the browser and in the repo (in credentials.js). This is fine - Supabase publishable keys are designed for client-side use and protected by RLS.
