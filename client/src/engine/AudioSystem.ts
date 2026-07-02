/**
 * AudioSystem
 *
 * Synthesizes procedural sound effects using the browser Web Audio API
 * without relying on external WAV or MP3 files. Designed for high audio polish,
 * realistic Minecraft-style acoustic cues, and robust browser autoplay compliance.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // AudioContext initialization is deferred to initContext() to respect
    // browser autoplay policies requiring prior user interaction.
  }

  /**
   * Lazily initializes the AudioContext or attempts to resume if suspended.
   */
  private initContext(): void {
    if (!this.enabled) {
      return;
    }

    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      } catch (e) {
        console.warn('Web Audio API not supported or failed to initialize:', e);
        return;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume().catch(() => {
          // Ignore resume errors when blocked by browser autoplay policy prior to interaction
        });
      } catch (e) {
        // Ignore synchronous exceptions during resume attempt
      }
    }
  }

  /**
   * Retrieves or generates a reusable white noise buffer for synthesizer noise bursts.
   */
  private getNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) {
      return null;
    }
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === this.ctx.sampleRate) {
      return this.noiseBuffer;
    }
    try {
      const sampleRate = this.ctx.sampleRate;
      const duration = 2.0; // 2 seconds of noise buffer to allow varied random offsets
      const frameCount = Math.floor(sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
      return buffer;
    } catch (e) {
      console.warn('Failed to create noise buffer:', e);
      return null;
    }
  }

  /**
   * Plays a block breaking sound: a crunchy, popping thud.
   * Uses a short white noise burst (150ms) filtered through a bandpass filter
   * (center frequency decreasing from 800Hz to 200Hz) plus an exponential gain decay.
   */
  public playBlockBreak(): void {
    if (!this.enabled) {
      return;
    }
    this.initContext();
    if (!this.ctx || this.ctx.state === 'closed') {
      return;
    }

    try {
      const now = this.ctx.currentTime;
      const duration = 0.15; // 150ms

      const noiseBuffer = this.getNoiseBuffer();
      if (!noiseBuffer) {
        return;
      }

      // 1. Bandpass-filtered white noise burst for crunchy texture
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.Q.setValueAtTime(2.8, now);
      bandpass.frequency.setValueAtTime(800, now);
      bandpass.frequency.exponentialRampToValueAtTime(200, now + duration);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      noiseGain.gain.setValueAtTime(0, now + duration);

      noiseSource.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      const maxOffset = Math.max(0, noiseBuffer.duration - duration - 0.1);
      const offset = Math.random() * maxOffset;
      noiseSource.start(now, offset, duration);

      // 2. Low-frequency pitch-drop thud for popping acoustic impact
      const thudOsc = this.ctx.createOscillator();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(120, now);
      thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

      const thudGain = this.ctx.createGain();
      thudGain.gain.setValueAtTime(0.4, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      thudGain.gain.setValueAtTime(0, now + 0.08);

      thudOsc.connect(thudGain);
      thudGain.connect(this.ctx.destination);

      thudOsc.start(now);
      thudOsc.stop(now + 0.08);
    } catch (e) {
      // Gracefully ignore audio synthesis errors
    }
  }

  /**
   * Plays a block placing sound: a solid, crisp click/thud.
   * Uses a sine/triangle wave pitch-dropping rapidly from 300Hz to 80Hz over 80ms,
   * combined with a 30ms high-frequency tick (noise filter at 2000Hz).
   */
  public playBlockPlace(): void {
    if (!this.enabled) {
      return;
    }
    this.initContext();
    if (!this.ctx || this.ctx.state === 'closed') {
      return;
    }

    try {
      const now = this.ctx.currentTime;

      // 1. Crisp thud body (triangle wave pitch dropping from 300Hz to 80Hz over 80ms)
      const thudDuration = 0.08; // 80ms
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + thudDuration);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + thudDuration);
      oscGain.gain.setValueAtTime(0, now + thudDuration);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + thudDuration);

      // 2. High-frequency tick (30ms noise pulse filtered at 2000Hz)
      const tickDuration = 0.03; // 30ms
      const noiseBuffer = this.getNoiseBuffer();
      if (noiseBuffer) {
        const tickSource = this.ctx.createBufferSource();
        tickSource.buffer = noiseBuffer;

        const tickFilter = this.ctx.createBiquadFilter();
        tickFilter.type = 'bandpass';
        tickFilter.frequency.setValueAtTime(2000, now);
        tickFilter.Q.setValueAtTime(2.0, now);

        const tickGain = this.ctx.createGain();
        tickGain.gain.setValueAtTime(0.35, now);
        tickGain.gain.exponentialRampToValueAtTime(0.001, now + tickDuration);
        tickGain.gain.setValueAtTime(0, now + tickDuration);

        tickSource.connect(tickFilter);
        tickFilter.connect(tickGain);
        tickGain.connect(this.ctx.destination);

        const maxOffset = Math.max(0, noiseBuffer.duration - tickDuration - 0.1);
        const offset = Math.random() * maxOffset;
        tickSource.start(now, offset, tickDuration);
      }
    } catch (e) {
      // Gracefully ignore audio synthesis errors
    }
  }

  /**
   * Plays a footstep sound: a very soft, muffled thud.
   * Uses a 60ms noise pulse filtered at 300Hz with low gain (~0.15).
   */
  public playFootstep(): void {
    if (!this.enabled) {
      return;
    }
    this.initContext();
    if (!this.ctx || this.ctx.state === 'closed') {
      return;
    }

    try {
      const now = this.ctx.currentTime;
      const duration = 0.06; // 60ms

      const noiseBuffer = this.getNoiseBuffer();
      if (!noiseBuffer) {
        return;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      // Lowpass filter at ~300Hz with slight variation for acoustic realism
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const cutoffFreq = 280 + Math.random() * 40; // ~300Hz
      filter.frequency.setValueAtTime(cutoffFreq, now);

      const gain = this.ctx.createGain();
      const peakGain = 0.13 + Math.random() * 0.04; // ~0.15
      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      gain.gain.setValueAtTime(0, now + duration);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      const maxOffset = Math.max(0, noiseBuffer.duration - duration - 0.1);
      const offset = Math.random() * maxOffset;
      noiseSource.start(now, offset, duration);
    } catch (e) {
      // Gracefully ignore audio synthesis errors
    }
  }

  /**
   * Plays a mob growl sound: an eerie, low-pitched growl or hum.
   * Uses oscillator frequency modulation from 120Hz down to 60Hz with sawtooth/triangle wave over 500ms,
   * lowpass filtered at 400Hz.
   */
  public playMobGrowl(): void {
    if (!this.enabled) {
      return;
    }
    this.initContext();
    if (!this.ctx || this.ctx.state === 'closed') {
      return;
    }

    try {
      const now = this.ctx.currentTime;
      const duration = 0.5; // 500ms

      // Primary oscillators: sawtooth + triangle for rich, organic creature texture
      const oscSaw = this.ctx.createOscillator();
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.setValueAtTime(120, now);
      oscSaw.frequency.exponentialRampToValueAtTime(60, now + duration);

      const oscTri = this.ctx.createOscillator();
      oscTri.type = 'triangle';
      // Slight detune (118Hz -> 59Hz) creates an eerie, unsettling beating timbre
      oscTri.frequency.setValueAtTime(118, now);
      oscTri.frequency.exponentialRampToValueAtTime(59, now + duration);

      // LFO for frequency modulation (rough vocal cord growl vibrato)
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(18, now); // 18Hz modulation rate
      lfo.frequency.linearRampToValueAtTime(10, now + duration);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(16, now); // +/- 16Hz FM depth
      lfoGain.gain.linearRampToValueAtTime(4, now + duration);

      lfo.connect(lfoGain);
      lfoGain.connect(oscSaw.frequency);
      lfoGain.connect(oscTri.frequency);

      // Lowpass filter at 400Hz
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.Q.setValueAtTime(1.8, now);

      // Envelope: smooth attack, sustain, and decay
      const growlGain = this.ctx.createGain();
      growlGain.gain.setValueAtTime(0.001, now);
      growlGain.gain.exponentialRampToValueAtTime(0.35, now + 0.05); // Attack
      growlGain.gain.setValueAtTime(0.35, now + 0.35); // Sustain
      growlGain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Release
      growlGain.gain.setValueAtTime(0, now + duration);

      oscSaw.connect(filter);
      oscTri.connect(filter);
      filter.connect(growlGain);
      growlGain.connect(this.ctx.destination);

      lfo.start(now);
      lfo.stop(now + duration);
      oscSaw.start(now);
      oscSaw.stop(now + duration);
      oscTri.start(now);
      oscTri.stop(now + duration);
    } catch (e) {
      // Gracefully ignore audio synthesis errors
    }
  }

  /**
   * Toggles sound on or off. Can accept an optional boolean parameter to explicitly enable or disable.
   */
  public toggleSound(enable?: boolean): void {
    if (typeof enable === 'boolean') {
      this.enabled = enable;
    } else {
      this.enabled = !this.enabled;
    }

    if (!this.enabled && this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.suspend().catch(() => {
          // Ignore suspend errors
        });
      } catch (e) {
        // Ignore errors
      }
    } else if (this.enabled && this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume().catch(() => {
          // Ignore resume errors
        });
      } catch (e) {
        // Ignore errors
      }
    }
  }
}

export const audio = new AudioSystem();

