/**
 * Web Audio API procedural sound synthesizer for elemental combinations.
 * Generates dynamic, pleasing chimes, whooshes, and glass resonance
 * without any external audio asset dependencies.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

/**
 * Plays a rich, procedural sound effect for element combinations.
 * Adapts timbre and chords based on ingredients and product.
 *
 * @param elementAId First ingredient ID
 * @param elementBId Second ingredient ID
 * @param productId Resulting element ID
 */
export function playCombinationSound(
  elementAId: string,
  elementBId: string,
  productId: string
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const isFire = elementAId === 'fire' || elementBId === 'fire' || elementAId === 'lava' || elementBId === 'lava';
    const isGlass = productId === 'glass' || productId === 'glasses';
    const isLightning = elementAId === 'lightning' || elementBId === 'lightning';

    // 1. Warm elemental sweep / sizzle
    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();

    sweepOsc.type = isFire ? 'sawtooth' : 'sine';
    const startFreq = isFire ? 180 : 260;
    const endFreq = isGlass ? 880 : 520;

    sweepOsc.frequency.setValueAtTime(startFreq, now);
    sweepOsc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.18);

    sweepGain.gain.setValueAtTime(0.08, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    // Filter to soften the sweep
    const filter = ctx.createBiquadFilter();
    filter.type = isFire ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(isFire ? 800 : 1200, now);

    sweepOsc.connect(filter);
    filter.connect(sweepGain);
    sweepGain.connect(ctx.destination);

    sweepOsc.start(now);
    sweepOsc.stop(now + 0.26);

    // 2. Harmonic chord / chime
    // If glass: crystalline high chime notes [C6, E6, G6, C7]
    // If general: magical warm ascending triad [A4, C#5, E5]
    const chimeFrequencies = isGlass
      ? [1046.5, 1318.5, 1567.9, 2093.0]
      : isLightning
      ? [587.33, 739.99, 880.0, 1174.66]
      : [440.0, 554.37, 659.25];

    chimeFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isGlass ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);

      const noteStart = now + idx * 0.035;
      const noteDuration = isGlass ? 0.65 : 0.45;

      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(0.09 / (idx + 1), noteStart + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + noteDuration);
    });
  } catch {
    // Gracefully ignore any audio context errors
  }
}
