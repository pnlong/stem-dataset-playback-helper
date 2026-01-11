// Web Audio API utilities

// Create AudioContext (reuse across page)
const AudioContext = window.AudioContext || window.webkitAudioContext;
export const audioContext = new AudioContext();

/**
 * Load an audio file from URL and decode it
 * @param {string} url - URL to the audio file
 * @returns {Promise<AudioBuffer>} - Decoded audio buffer
 */
export async function loadAudioBuffer(url) {
  try {
    const response = await fetch(url, {
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error('Error loading audio buffer:', error);
    throw error;
  }
}

/**
 * Create a click track (metronome) at specified BPM
 * @param {number} bpm - Beats per minute
 * @param {number} durationSeconds - Duration in seconds
 * @param {number} beatsPerBar - Beats per bar (from time signature numerator)
 * @param {boolean} includeCountIn - Include count-in at different pitch (default false)
 * @returns {AudioBuffer} - Click track audio buffer
 */
export function createClickTrack(bpm, durationSeconds, beatsPerBar = 4, includeCountIn = false) {
  const sampleRate = audioContext.sampleRate;
  const numChannels = 2; // Stereo

  const secondsPerBeat = 60 / bpm;
  const countInDuration = includeCountIn ? beatsPerBar * secondsPerBeat : 0;
  const totalDuration = durationSeconds + countInDuration;
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  console.log('Creating click track - BPM:', bpm, 'Duration:', durationSeconds, 'BeatsPerBar:', beatsPerBar, 'IncludeCountIn:', includeCountIn);
  console.log('Click track - secondsPerBeat:', secondsPerBeat, 'totalDuration:', totalDuration);

  const buffer = audioContext.createBuffer(numChannels, totalSamples, sampleRate);

  // Generate click sounds
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);

    let beatNumber = 0;
    let currentTime = 0;

    // Generate count-in beats (higher pitch, different sound)
    // Count-in uses beatsPerBar from time signature numerator
    if (includeCountIn) {
      for (let i = 0; i < beatsPerBar; i++) {
        const startSample = Math.floor(currentTime * sampleRate);

        // Count-in uses higher pitch to distinguish from main click
        const frequency = 1200; // Higher than regular downbeat
        const amplitude = 0.35;
        const clickDuration = 0.05; // 50ms click

        // Generate sine wave click
        for (let j = 0; j < clickDuration * sampleRate && startSample + j < totalSamples; j++) {
          const t = j / sampleRate;
          const envelope = Math.exp(-t * 30); // Exponential decay
          channelData[startSample + j] = amplitude * envelope * Math.sin(2 * Math.PI * frequency * t);
        }

        currentTime += secondsPerBeat;
      }
      beatNumber = 0; // Reset beat number after count-in
    }

    // Generate main click track
    for (let beatTime = currentTime; beatTime < totalDuration; beatTime += secondsPerBeat) {
      const startSample = Math.floor(beatTime * sampleRate);

      // First beat of bar is louder/higher pitch
      const isDownbeat = (beatNumber % beatsPerBar) === 0;
      const frequency = isDownbeat ? 1000 : 800; // Hz
      const amplitude = isDownbeat ? 0.3 : 0.2;
      const clickDuration = 0.05; // 50ms click

      // Generate sine wave click
      for (let i = 0; i < clickDuration * sampleRate && startSample + i < totalSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 30); // Exponential decay
        channelData[startSample + i] = amplitude * envelope * Math.sin(2 * Math.PI * frequency * t);
      }

      beatNumber++;
    }
  }

  return buffer;
}

/**
 * Create a count-in (4 beats) at specified BPM
 * @param {number} bpm - Beats per minute
 * @returns {AudioBuffer} - Count-in audio buffer
 */
export function createCountIn(bpm) {
  const durationBeats = 4;
  const secondsPerBeat = 60 / bpm;
  const durationSeconds = durationBeats * secondsPerBeat;

  return createClickTrack(bpm, durationSeconds, 4);
}

/**
 * Apply offset to an audio buffer (negative = prepend silence, positive = trim start)
 * @param {AudioBuffer} buffer - Original audio buffer
 * @param {number} offsetSeconds - Offset in seconds
 * @returns {AudioBuffer} - New buffer with offset applied
 */
export function applyOffsetToBuffer(buffer, offsetSeconds) {
  const sampleRate = buffer.sampleRate;
  const offsetSamples = Math.floor(Math.abs(offsetSeconds) * sampleRate);

  let newLength, startSample;

  if (offsetSeconds < 0) {
    // Prepend silence
    newLength = buffer.length + offsetSamples;
    startSample = offsetSamples;
  } else {
    // Trim from start
    newLength = Math.max(0, buffer.length - offsetSamples);
    startSample = 0;
  }

  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    newLength,
    sampleRate
  );

  // Copy audio data
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const oldData = buffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    if (offsetSeconds < 0) {
      // Copy original data after silence
      for (let i = 0; i < buffer.length; i++) {
        newData[startSample + i] = oldData[i];
      }
    } else {
      // Copy data starting from offset
      for (let i = 0; i < newLength; i++) {
        newData[i] = oldData[offsetSamples + i];
      }
    }
  }

  return newBuffer;
}

/**
 * Mix multiple audio buffers with volume levels
 * @param {Array<AudioBuffer>} buffers - Array of audio buffers to mix
 * @param {Array<number>} volumes - Array of volume levels (0.0 to 1.0)
 * @param {number} targetDuration - Optional target duration in seconds (will extend with silence if longer than stems)
 * @returns {AudioBuffer} - Mixed audio buffer
 */
export function mixBuffers(buffers, volumes, targetDuration = null) {
  if (buffers.length === 0) return null;
  if (buffers.length !== volumes.length) {
    throw new Error('Number of buffers must match number of volumes');
  }

  // Find the longest buffer to determine output length
  const maxLength = Math.max(...buffers.map(b => b.length));
  const sampleRate = buffers[0].sampleRate;
  const numChannels = 2; // Always output stereo

  // Determine final output length - use target duration if specified and longer than stems
  let outputLength = maxLength;
  if (targetDuration !== null) {
    const targetSamples = Math.ceil(targetDuration * sampleRate);
    outputLength = Math.max(maxLength, targetSamples);
  }

  const mixedBuffer = audioContext.createBuffer(numChannels, outputLength, sampleRate);

  // Mix each channel
  for (let channel = 0; channel < numChannels; channel++) {
    const outputData = mixedBuffer.getChannelData(channel);

    buffers.forEach((buffer, bufferIndex) => {
      const volume = volumes[bufferIndex];
      if (volume === 0) return; // Skip muted tracks

      // Get source channel (or mono if buffer has fewer channels)
      const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
      const sourceData = buffer.getChannelData(sourceChannel);

      // Add to mix with volume
      for (let i = 0; i < buffer.length; i++) {
        outputData[i] = (outputData[i] || 0) + sourceData[i] * volume;
      }
    });

    // Remaining samples are already initialized to 0 (silence) by createBuffer
  }

  return mixedBuffer;
}

/**
 * Play an audio buffer
 * @param {AudioBuffer} buffer - Audio buffer to play
 * @returns {AudioBufferSourceNode} - Source node (for stopping)
 */
export function playBuffer(buffer) {
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(0);
  return source;
}

/**
 * Draw waveform to canvas
 * @param {AudioBuffer} buffer - Audio buffer to visualize
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {string} color - Waveform color (default: '#4CAF50')
 */
export function drawWaveformToCanvas(buffer, canvas, color = '#4CAF50') {
  if (!buffer || !canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);

  // Get channel data (use first channel for visualization)
  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const amp = height / 2;

  // Draw center line
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, amp);
  ctx.lineTo(width, amp);
  ctx.stroke();

  // Draw waveform
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let i = 0; i < width; i++) {
    // Get min and max in this segment
    let min = 1.0;
    let max = -1.0;

    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }

    const yMin = (1 + min) * amp;
    const yMax = (1 + max) * amp;

    if (i === 0) {
      ctx.moveTo(i, (yMin + yMax) / 2);
    } else {
      ctx.lineTo(i, yMin);
      ctx.lineTo(i, yMax);
    }
  }

  ctx.stroke();
}

/**
 * Draw waveform with bar gridlines
 * @param {AudioBuffer} buffer - Audio buffer to visualize
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {number} bpm - Beats per minute for gridlines
 * @param {number} beatsPerBar - Beats per bar (from time signature numerator)
 * @param {string} color - Waveform color (default: '#4CAF50')
 */
export function drawWaveformWithGridlines(buffer, canvas, bpm, beatsPerBar = 4, color = '#4CAF50') {
  if (!buffer || !canvas || !bpm) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);

  // Get channel data (use first channel for visualization)
  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const amp = height / 2;

  // Draw center line
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, amp);
  ctx.lineTo(width, amp);
  ctx.stroke();

  // Draw waveform
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let i = 0; i < width; i++) {
    // Get min and max in this segment
    let min = 1.0;
    let max = -1.0;

    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }

    const yMin = (1 + min) * amp;
    const yMax = (1 + max) * amp;

    if (i === 0) {
      ctx.moveTo(i, (yMin + yMax) / 2);
    } else {
      ctx.lineTo(i, yMin);
      ctx.lineTo(i, yMax);
    }
  }

  ctx.stroke();

  // Draw vertical gridlines for each bar AFTER waveform so they appear on top
  // Calculate bar duration using time signature
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const duration = buffer.duration;

  console.log('Gridline drawing - BPM:', bpm, 'BeatsPerBar:', beatsPerBar, 'Duration:', duration);
  console.log('Gridline drawing - secondsPerBeat:', secondsPerBeat, 'secondsPerBar:', secondsPerBar);

  // Make gridlines look similar to playhead indicator but different color
  ctx.strokeStyle = '#0066cc'; // Blue color to distinguish from red playhead
  ctx.lineWidth = 2; // Same width as playhead indicator

  // Draw gridlines at bar boundaries
  // Start at 0 and increment by exactly secondsPerBar to match click track timing
  let barTime = 0;
  let barNumber = 0;
  const gridlineTimes = [];
  while (barTime <= duration) {
    // Convert time to pixel position
    const x = Math.round((barTime / duration) * width);
    gridlineTimes.push({ barNumber, time: barTime, x });
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    barNumber++;
    barTime = barNumber * secondsPerBar; // Use multiplication to avoid accumulating rounding errors
  }
  console.log('Gridlines drawn at:', gridlineTimes);
}

/**
 * Resume audio context (required for user interaction on some browsers)
 */
export async function resumeAudioContext() {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}
