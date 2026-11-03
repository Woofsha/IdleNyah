// src/audio/sfx.ts
import type { SfxType } from './types';

/**
 * Procedural retro synthesizer for cozy sound effects using native Web Audio API nodes.
 * All created oscillators and ephemeral gain nodes automatically disconnect when finished
 * to prevent memory leaks during rapid clicking.
 */
export function playProceduralSfx(ctx: AudioContext, destination: AudioNode, type: SfxType): void {
  const t = ctx.currentTime;

  switch (type) {
    case 'click': {
      // Crisp wooden/glass tap: 900Hz -> 450Hz in 35ms, triangle wave
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(450, t + 0.035);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(t);
      osc.stop(t + 0.05);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      break;
    }

    case 'coin': {
      // Warm Stardew-esque pentatonic bell chime: E6 staggered to B6, pure sine wave
      const playTone = (freq: number, start: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(start);
        osc.stop(start + 0.32);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      };

      playTone(1318.51, t); // E6
      playTone(1975.53, t + 0.06); // B6
      break;
    }

    case 'frenzy': {
      // Energetic 5-note rising pentatonic arpeggio (C5, E5, G5, C6, E6)
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((freq, i) => {
        const noteTime = t + i * 0.045;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.22);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.25);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
      break;
    }

    case 'catch': {
      // 4-note victory flourish: G5 -> C6 -> E6 -> G6 sustained chord
      const notes = [
        { f: 783.99, start: 0, dur: 0.1 },
        { f: 1046.5, start: 0.09, dur: 0.1 },
        { f: 1318.51, start: 0.18, dur: 0.12 },
        { f: 1567.98, start: 0.28, dur: 0.5 },
      ];

      notes.forEach((n) => {
        const noteTime = t + n.start;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, noteTime);

        gain.gain.setValueAtTime(0.22, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + n.dur);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(noteTime);
        osc.stop(noteTime + n.dur + 0.02);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
      break;
    }

    case 'fanfare': {
      // Majestic herald C5 -> G5 -> C6 -> E6 culminating in warm major triad chord
      const heraldNotes = [
        { f: 523.25, time: 0, dur: 0.12 },
        { f: 783.99, time: 0.11, dur: 0.12 },
        { f: 1046.5, time: 0.22, dur: 0.14 },
        { f: 1318.51, time: 0.35, dur: 0.2 },
      ];

      heraldNotes.forEach((hn) => {
        const start = t + hn.time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hn.f, start);

        gain.gain.setValueAtTime(0.24, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + hn.dur);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(start);
        osc.stop(start + hn.dur + 0.02);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });

      // Triad chord sustained at end
      const chordStart = t + 0.52;
      const triad = [261.63, 523.25, 659.25, 783.99, 1046.5]; // C4, C5, E5, G5, C6
      triad.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, chordStart);

        gain.gain.setValueAtTime(0.12, chordStart);
        gain.gain.exponentialRampToValueAtTime(0.0001, chordStart + 1.2);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(chordStart);
        osc.stop(chordStart + 1.25);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
      break;
    }

    case 'petting': {
      // Gentle rising chime: A5 (880Hz) -> C#6 (1108Hz) -> E6 (1318Hz) soft sine wave
      const notes = [880.0, 1108.73, 1318.51];
      notes.forEach((freq, idx) => {
        const start = t + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(start);
        osc.stop(start + 0.35);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
      break;
    }

    case 'upgrade': {
      // Cozy pleasant upgrade chime: C5 (523Hz) -> G5 (784Hz) -> C6 (1046Hz) bright ascending bell
      const notes = [523.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = t + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(start);
        osc.stop(start + 0.38);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
      break;
    }
  }
}
