// Sound, synthesized live with WebAudio: no audio files, no network. Everything is a
// short oscillator blip, so the game stays silent until the first key or click, when
// the audio context is allowed to start.

export function createAudio() {
  let context = null;
  let sirenTimer = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, gainValue, slideTo) {
    if (!ensure() || !context) return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + seconds);
      gain.gain.setValueAtTime(gainValue || 0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      osc.connect(gain).connect(context.destination);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    unlock() { ensure(); },
    click() { tone(660, 0.06, 'square', 0.05); },
    cash() { tone(880, 0.09, 'sine', 0.07); setTimeout(() => tone(1320, 0.12, 'sine', 0.07), 90); },
    pickup() { tone(520, 0.08, 'triangle', 0.07, 780); },
    crash() { tone(120, 0.18, 'sawtooth', 0.1, 60); },
    busted() { tone(220, 0.4, 'sawtooth', 0.09, 110); },
    jobDone() {
      tone(523, 0.12, 'sine', 0.07);
      setTimeout(() => tone(659, 0.12, 'sine', 0.07), 120);
      setTimeout(() => tone(784, 0.2, 'sine', 0.07), 240);
    },
    /** A two-tone VPD siren blip, at most once every 1.6 s, while wanted. */
    siren(dt, wanted) {
      if (wanted <= 0) return;
      sirenTimer -= dt;
      if (sirenTimer > 0) return;
      sirenTimer = 1.6;
      tone(720, 0.22, 'sine', 0.035, 960);
      setTimeout(() => tone(960, 0.22, 'sine', 0.035, 720), 240);
    },
  };
}
