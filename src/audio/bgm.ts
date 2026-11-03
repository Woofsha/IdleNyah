// src/audio/bgm.ts

/**
 * Procedural Cozy Background Music Generator (Stardew Valley / Animal Crossing vibes).
 * Synthesizes relaxing, looping melodies and warm diatonic chord pads in C Major at 76 BPM
 * through a soft 1400Hz lowpass filter with lookahead scheduling.
 */

// Chord definitions: root bass freq, chord frequencies
interface ChordInfo {
  bass: number;
  chord: number[];
  arpeggio: number[];
}

// 76 BPM -> ~789.47ms per beat, 3.158s per 4-beat measure
const BPM = 76;
const BEAT_DURATION = 60 / BPM; // ~0.7895s
const MEASURE_DURATION = BEAT_DURATION * 4; // ~3.158s

// Diatonic chords in C Major:
// I: C major, V: G major, vi: A minor, IV: F major
const CHORDS: ChordInfo[] = [
  // C Major (I)
  {
    bass: 130.81, // C3
    chord: [261.63, 329.63, 392.0], // C4, E4, G4
    arpeggio: [523.25, 659.25, 783.99, 1046.5], // C5, E5, G5, C6
  },
  // G Major (V)
  {
    bass: 98.0, // G2
    chord: [196.0, 246.94, 293.66], // G3, B3, D4
    arpeggio: [392.0, 493.88, 587.33, 783.99], // G4, B4, D5, G5
  },
  // A Minor (vi)
  {
    bass: 110.0, // A2
    chord: [220.0, 261.63, 329.63], // A3, C4, E4
    arpeggio: [440.0, 523.25, 659.25, 880.0], // A4, C5, E5, A5
  },
  // F Major (IV)
  {
    bass: 87.31, // F2
    chord: [174.61, 220.0, 261.63], // F3, A3, C4
    arpeggio: [349.23, 440.0, 523.25, 698.46], // F4, A4, C5, F5
  },
];

export class ProceduralBgmPlayer {
  private ctx: AudioContext | null = null;
  private outputNode: AudioNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private isPlaying = false;
  private timerId: ReturnType<typeof setInterval> | null = null;

  private currentMeasure = 0;
  private nextMeasureTime = 0;
  private activeNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

  public start(ctx: AudioContext, destination: AudioNode): void {
    if (this.isPlaying) return;
    this.ctx = ctx;
    this.outputNode = destination;

    // Create warm lowpass filter to eliminate digital harshness
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 1400;
    this.filterNode.Q.value = 0.7;
    this.filterNode.connect(destination);

    this.isPlaying = true;
    this.currentMeasure = 0;
    this.nextMeasureTime = ctx.currentTime + 0.05;

    // Lookahead scheduler running every 50ms, scheduling up to 200ms ahead
    this.timerId = setInterval(() => {
      this.scheduler();
    }, 50);
  }

  public stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    // Stop and disconnect all active synth nodes
    for (const { osc, gain } of this.activeNodes) {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Safe ignore
      }
    }
    this.activeNodes = [];

    if (this.filterNode) {
      try {
        this.filterNode.disconnect();
      } catch {
        // Safe ignore
      }
      this.filterNode = null;
    }
  }

  private scheduler(): void {
    if (!this.isPlaying || !this.ctx || !this.filterNode) return;

    // Schedule measures while next measure time is within lookahead window (200ms)
    while (this.nextMeasureTime < this.ctx.currentTime + 0.2) {
      this.scheduleMeasure(this.nextMeasureTime, this.currentMeasure % CHORDS.length);
      this.nextMeasureTime += MEASURE_DURATION;
      this.currentMeasure++;
    }
  }

  private scheduleMeasure(startTime: number, chordIndex: number): void {
    if (!this.ctx || !this.filterNode) return;
    const ctx = this.ctx;
    const dest = this.filterNode;
    const chord = CHORDS[chordIndex];

    // 1. Bass note on Beat 1 and Beat 3
    this.playBassNote(ctx, dest, chord.bass, startTime, BEAT_DURATION * 1.8);
    this.playBassNote(ctx, dest, chord.bass * 1.5, startTime + BEAT_DURATION * 2, BEAT_DURATION * 1.8);

    // 2. Warm soft triangle pad chord on Beat 1 decaying over measure
    for (const freq of chord.chord) {
      this.playPadTone(ctx, dest, freq, startTime, MEASURE_DURATION * 0.95);
    }

    // 3. Gentle pentatonic arpeggio notes across the 4 beats
    // Beat 1: arpeggio[0], Beat 2: arpeggio[1], Beat 3: arpeggio[2], Beat 4: arpeggio[3] or arpeggio[1]
    const arpSeq = [chord.arpeggio[0], chord.arpeggio[1], chord.arpeggio[2], chord.arpeggio[1]];
    arpSeq.forEach((freq, beat) => {
      const noteTime = startTime + beat * BEAT_DURATION + 0.02;
      this.playArpTone(ctx, dest, freq, noteTime, BEAT_DURATION * 0.8);
    });
  }

  private playBassNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    duration: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(start);
    osc.stop(start + duration + 0.02);

    const ref = { osc, gain };
    this.activeNodes.push(ref);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      const idx = this.activeNodes.indexOf(ref);
      if (idx !== -1) this.activeNodes.splice(idx, 1);
    };
  }

  private playPadTone(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    duration: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.035, start + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(start);
    osc.stop(start + duration + 0.05);

    const ref = { osc, gain };
    this.activeNodes.push(ref);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      const idx = this.activeNodes.indexOf(ref);
      if (idx !== -1) this.activeNodes.splice(idx, 1);
    };
  }

  private playArpTone(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    start: number,
    duration: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.045, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(start);
    osc.stop(start + duration + 0.02);

    const ref = { osc, gain };
    this.activeNodes.push(ref);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      const idx = this.activeNodes.indexOf(ref);
      if (idx !== -1) this.activeNodes.splice(idx, 1);
    };
  }
}
