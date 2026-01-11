// Database functions for Supabase operations
import { supabase } from './config.js';

// ===== HELPERS =====

/**
 * Generate a timestamp-based take name
 * @returns {string} - Take name in format "YYYY-MM-DD_HH-MM-SS"
 */
export function generateTakeName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// ===== INSTRUMENTS =====

/**
 * Save instruments to database, replacing any existing ones
 * @param {Array<string>} instruments - Array of instrument names in order
 * @returns {Promise<Array>} - Saved instrument records
 */
export async function saveInstruments(instruments) {
  try {
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

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving instruments:', error);
    throw error;
  }
}

/**
 * Get all instruments ordered by their recording order
 * @returns {Promise<Array>} - Array of instrument records
 */
export async function getAllInstruments() {
  try {
    const { data, error } = await supabase
      .from('instruments')
      .select('*')
      .order('order_index');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching instruments:', error);
    throw error;
  }
}

// ===== SONGS =====

/**
 * Upsert songs to database (insert or update)
 * @param {Array<Object>} songs - Array of song objects with song_id, title, bpm
 * @returns {Promise<void>}
 */
export async function upsertSongs(songs) {
  try {
    const { error } = await supabase
      .from('songs')
      .upsert(songs, { onConflict: 'song_id' });

    if (error) throw error;
  } catch (error) {
    console.error('Error upserting songs:', error);
    throw error;
  }
}

/**
 * Get all songs ordered by song_id
 * @returns {Promise<Array>} - Array of song records
 */
export async function getAllSongs() {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('song_id');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching songs:', error);
    throw error;
  }
}

/**
 * Get a single song by ID
 * @param {number} songId - The song_id to fetch
 * @returns {Promise<Object>} - Song record
 */
export async function getSong(songId) {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('song_id', songId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching song:', error);
    throw error;
  }
}

/**
 * Update a song's BPM
 * @param {number} songId - The song_id to update
 * @param {number} bpm - New BPM value
 * @returns {Promise<Object>} - Updated song record
 */
export async function updateSongBPM(songId, bpm) {
  try {
    const { data, error} = await supabase
      .from('songs')
      .update({ bpm: bpm })
      .eq('song_id', songId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating song BPM:', error);
    throw error;
  }
}

/**
 * Update a song's time signature
 * @param {number} songId - The song_id to update
 * @param {string} timeSignature - New time signature (e.g., "4/4", "3/4", "6/8")
 * @returns {Promise<Object>} - Updated song record
 */
export async function updateSongTimeSignature(songId, timeSignature) {
  try {
    const { data, error } = await supabase
      .from('songs')
      .update({ time_signature: timeSignature })
      .eq('song_id', songId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating song time signature:', error);
    throw error;
  }
}

// ===== STEMS =====

/**
 * Get all stems for a specific song with instrument details
 * @param {number} songId - The song_id to fetch stems for
 * @returns {Promise<Array>} - Array of stem records with instrument data
 */
export async function getStemsBySong(songId) {
  try {
    const { data, error } = await supabase
      .from('stems')
      .select(`
        *,
        instruments (
          instrument_id,
          instrument_name,
          order_index
        )
      `)
      .eq('song_id', songId);

    if (error) throw error;

    // Sort by instrument order
    const sorted = (data || []).sort((a, b) =>
      a.instruments.order_index - b.instruments.order_index
    );

    return sorted;
  } catch (error) {
    console.error('Error fetching stems:', error);
    throw error;
  }
}

/**
 * Get all takes for a specific song and instrument
 * @param {number} songId - The song_id
 * @param {number} instrumentId - The instrument_id
 * @returns {Promise<Array>} - Array of take records sorted alphabetically by take name
 */
export async function getTakesByInstrument(songId, instrumentId) {
  try {
    const { data, error } = await supabase
      .from('stems')
      .select('*')
      .eq('song_id', songId)
      .eq('instrument_id', instrumentId)
      .order('take');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching takes:', error);
    throw error;
  }
}

/**
 * Upsert a stem record (insert or update)
 * @param {number} songId - The song_id
 * @param {number} instrumentId - The instrument_id
 * @param {string} take - The take name/identifier
 * @param {string} wavUrl - URL to the WAV file
 * @param {number} offsetSeconds - Offset in seconds
 * @returns {Promise<Object>} - Saved stem record
 */
export async function upsertStem(songId, instrumentId, take, wavUrl, offsetSeconds) {
  try {
    const { data, error } = await supabase
      .from('stems')
      .upsert({
        song_id: songId,
        instrument_id: instrumentId,
        take: take,
        wav_url: wavUrl,
        offset_seconds: offsetSeconds,
        updated_at: new Date().toISOString()
      }, { onConflict: 'song_id,instrument_id,take' })
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error upserting stem:', error);
    throw error;
  }
}

/**
 * Get all stems across all songs
 * @returns {Promise<Array>} - Array of all stem records
 */
export async function getAllStems() {
  try {
    const { data, error } = await supabase
      .from('stems')
      .select('*');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all stems:', error);
    throw error;
  }
}

/**
 * Get stem counts per song (counts instruments with at least one take, not total takes)
 * @returns {Promise<Object>} - Object mapping song_id to count of instruments with stems
 */
export async function getStemCounts() {
  try {
    const { data, error } = await supabase
      .from('stems')
      .select('song_id, instrument_id');

    if (error) throw error;

    // Count unique (song_id, instrument_id) pairs per song
    // An instrument is considered complete if it has at least one take
    const counts = {};
    const seen = new Set();

    (data || []).forEach(stem => {
      const key = `${stem.song_id}_${stem.instrument_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        counts[stem.song_id] = (counts[stem.song_id] || 0) + 1;
      }
    });

    return counts;
  } catch (error) {
    console.error('Error fetching stem counts:', error);
    throw error;
  }
}

/**
 * Add a new song
 * @param {number} songId - Song ID
 * @param {string} title - Song title
 * @param {number} bpm - Beats per minute
 * @param {string} timeSignature - Time signature (e.g., "4/4")
 * @returns {Promise<Object>} - Created song record
 */
export async function addSong(songId, title, bpm, timeSignature) {
  try {
    const { data, error } = await supabase
      .from('songs')
      .insert({
        song_id: songId,
        title: title,
        bpm: bpm,
        time_signature: timeSignature
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding song:', error);
    throw error;
  }
}

/**
 * Delete a song and all its stems
 * @param {number} songId - Song ID to delete
 * @returns {Promise<void>}
 */
export async function deleteSong(songId) {
  try {
    // First get all stems for this song to delete their WAV files
    const { data: stems, error: fetchError } = await supabase
      .from('stems')
      .select('wav_url')
      .eq('song_id', songId);

    if (fetchError) throw fetchError;

    // Delete all WAV files for this song's stems
    if (stems && stems.length > 0) {
      for (const stem of stems) {
        try {
          await deleteWavFile(stem.wav_url);
        } catch (storageError) {
          console.warn('Warning: Could not delete WAV file from storage:', storageError);
          // Continue with deletion even if storage deletion fails
        }
      }
    }

    // Delete all stems for this song
    const { error: deleteStremsError } = await supabase
      .from('stems')
      .delete()
      .eq('song_id', songId);

    if (deleteStremsError) throw deleteStremsError;

    // Delete the song itself
    const { error: deleteSongError } = await supabase
      .from('songs')
      .delete()
      .eq('song_id', songId);

    if (deleteSongError) throw deleteSongError;
  } catch (error) {
    console.error('Error deleting song:', error);
    throw error;
  }
}

/**
 * Delete a stem by song_id, instrument_id, and take
 * @param {number} songId - Song ID
 * @param {number} instrumentId - Instrument ID
 * @param {string} take - Take name/identifier
 * @returns {Promise<void>}
 */
export async function deleteStem(songId, instrumentId, take) {
  try {
    // First get the stem to find the WAV URL
    const { data: stem, error: fetchError } = await supabase
      .from('stems')
      .select('wav_url')
      .eq('song_id', songId)
      .eq('instrument_id', instrumentId)
      .eq('take', take)
      .single();

    if (fetchError) throw fetchError;

    // Delete the WAV file from storage if it exists
    if (stem && stem.wav_url) {
      try {
        await deleteWavFile(stem.wav_url);
      } catch (storageError) {
        console.warn('Warning: Could not delete WAV file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete the stem from database
    const { error: deleteError } = await supabase
      .from('stems')
      .delete()
      .eq('song_id', songId)
      .eq('instrument_id', instrumentId)
      .eq('take', take);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error('Error deleting stem:', error);
    throw error;
  }
}

// ===== RESET =====

/**
 * Delete all data from the database and storage
 * WARNING: This cannot be undone!
 * @returns {Promise<void>}
 */
export async function deleteAllData() {
  try {
    // Delete ALL WAV files from storage first
    await deleteAllWavFiles();

    // Delete ALL rows from each table (Supabase requires a filter, so we use one that matches everything)
    // Delete in order to respect foreign key constraints
    await supabase.from('stems').delete().not('id', 'is', null);
    await supabase.from('songs').delete().neq('song_id', -999999999);
    await supabase.from('instruments').delete().neq('instrument_id', -999999999);
    await supabase.from('settings').delete().neq('key', '');
  } catch (error) {
    console.error('Error deleting all data:', error);
    throw error;
  }
}

// ===== PASSWORDS =====

/**
 * Save website and admin passwords
 * @param {string} websitePassword - Website access password
 * @param {string} adminPassword - Admin password for reset operations
 * @returns {Promise<void>}
 */
export async function savePasswords(websitePassword, adminPassword) {
  try {
    // Delete existing settings first
    await supabase.from('settings').delete().eq('key', 'passwords');

    // Insert new passwords
    const { error } = await supabase
      .from('settings')
      .insert({
        key: 'passwords',
        value: {
          website: websitePassword,
          admin: adminPassword
        }
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving passwords:', error);
    throw error;
  }
}

/**
 * Get stored passwords
 * @returns {Promise<Object>} - Object with website and admin passwords
 */
export async function getPasswords() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'passwords')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No passwords set yet
        return null;
      }
      throw error;
    }

    return data.value;
  } catch (error) {
    console.error('Error fetching passwords:', error);
    throw error;
  }
}

/**
 * Verify website password
 * @param {string} password - Password to verify
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyWebsitePassword(password) {
  try {
    const passwords = await getPasswords();
    if (!passwords) return false;
    return passwords.website === password;
  } catch (error) {
    console.error('Error verifying website password:', error);
    return false;
  }
}

/**
 * Verify admin password
 * @param {string} password - Password to verify
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyAdminPassword(password) {
  try {
    const passwords = await getPasswords();
    if (!passwords) return false;
    return passwords.admin === password;
  } catch (error) {
    console.error('Error verifying admin password:', error);
    return false;
  }
}

// ===== STORAGE =====

/**
 * Upload a WAV file to Supabase Storage
 * @param {File} file - The WAV file to upload
 * @param {number} songId - The song_id
 * @param {number} instrumentId - The instrument_id
 * @param {string} take - The take name/identifier
 * @param {Function} onProgress - Optional progress callback (receives percentage 0-100)
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
export async function uploadWavFile(file, songId, instrumentId, take, onProgress = null) {
  try {
    // Generate a unique filename: song_id_instrument_id_take_timestamp.wav
    // Sanitize take name for filename (replace spaces and special chars with underscores)
    const sanitizedTake = take.replace(/[^a-zA-Z0-9-]/g, '_');
    const timestamp = Date.now();
    const filename = `${songId}_${instrumentId}_${sanitizedTake}_${timestamp}.wav`;
    const filePath = `stems/${filename}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('wav-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('wav-files')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading WAV file:', error);
    throw error;
  }
}

/**
 * Delete a WAV file from Supabase Storage by its URL
 * @param {string} publicUrl - The public URL of the file to delete
 * @returns {Promise<void>}
 */
export async function deleteWavFile(publicUrl) {
  try {
    // Extract the file path from the public URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/wav-files/stems/filename.wav
    const urlParts = publicUrl.split('/wav-files/');
    if (urlParts.length < 2) {
      console.warn('Invalid WAV file URL format:', publicUrl);
      return;
    }
    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from('wav-files')
      .remove([filePath]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting WAV file:', error);
    // Don't throw - allow cleanup to continue even if file deletion fails
  }
}

/**
 * Get all WAV files from storage
 * @returns {Promise<Array>} - Array of file objects with name, url, and metadata
 */
export async function getAllWavFiles() {
  try {
    const { data, error } = await supabase.storage
      .from('wav-files')
      .list('stems', {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) throw error;

    // Get public URLs for all files
    const filesWithUrls = data.map(file => {
      const { data: publicUrlData } = supabase.storage
        .from('wav-files')
        .getPublicUrl(`stems/${file.name}`);

      return {
        name: file.name,
        url: publicUrlData.publicUrl,
        size: file.metadata?.size,
        created_at: file.created_at
      };
    });

    return filesWithUrls;
  } catch (error) {
    console.error('Error fetching WAV files:', error);
    throw error;
  }
}

/**
 * Delete all WAV files from storage (used during reset)
 * @returns {Promise<void>}
 */
export async function deleteAllWavFiles() {
  try {
    // List all files in the stems folder
    const { data: files, error: listError } = await supabase.storage
      .from('wav-files')
      .list('stems');

    if (listError) throw listError;

    if (!files || files.length === 0) {
      return;
    }

    // Delete all files
    const filePaths = files.map(file => `stems/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from('wav-files')
      .remove(filePaths);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error('Error deleting all WAV files:', error);
    // Don't throw - allow reset to continue even if file deletion fails
  }
}

// ===== SETUP CHECK =====

/**
 * Check if the database has been set up (has instruments and songs)
 * @returns {Promise<Object>} - Object with hasInstruments and hasSongs booleans
 */
export async function checkSetupStatus() {
  try {
    const [instruments, songs, passwords] = await Promise.all([
      getAllInstruments(),
      getAllSongs(),
      getPasswords()
    ]);

    return {
      hasPasswords: passwords !== null,
      hasInstruments: instruments.length > 0,
      hasSongs: songs.length > 0
    };
  } catch (error) {
    console.error('Error checking setup status:', error);
    return {
      hasPasswords: false,
      hasInstruments: false,
      hasSongs: false
    };
  }
}
