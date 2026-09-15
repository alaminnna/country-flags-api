'use client';

// Optional sound — WebAudio-synthesized only, no assets. Never delays interaction.
// Mute toggle persisted in localStorage (flags.quiz.sound, default OFF).

const KEY = 'flags.quiz.sound';

export function loadSoundPref(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveSoundPref(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* private mode */
  }
}

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (ctx) return ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, dur: number, db: number, type: OscillatorType = 'sine') {
  const c = ac();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const amp = Math.pow(10, db / 20);
    g.gain.setValueAtTime(0.0001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), c.currentTime + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + dur + 0.05);
  } catch {
    /* never break gameplay */
  }
}

export function sfxCorrect(enabled: boolean) {
  if (!enabled) return;
  // soft two-note chime 660→880Hz sine, -18dB
  tone(660, 0, 0.12, -18);
  tone(880, 0.09, 0.16, -18);
}

export function sfxWrong(enabled: boolean) {
  if (!enabled) return;
  // low thud 150Hz, -20dB
  tone(150, 0, 0.18, -20, 'triangle');
}

export function sfxTick(enabled: boolean) {
  if (!enabled) return;
  tone(990, 0, 0.05, -24, 'square');
}
