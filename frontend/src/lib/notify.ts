let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return ctx;
}

// Must be called synchronously inside a user tap handler (not useEffect).
export function unlockAudio() {
  try {
    const c = getCtx();
    if (c.state === 'suspended') c.resume();
  } catch { /* ignore */ }
}

function playTones(c: AudioContext) {
  const play = (freq: number, startAt: number, duration: number) => {
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.4, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    osc.start(startAt);
    osc.stop(startAt + duration);
  };
  const t = c.currentTime;
  play(880,  t,       0.18);
  play(1108, t + 0.2, 0.22);
}

export function playCodeArrivedSound() {
  // Vibration works on Android without any gesture restriction
  try { navigator.vibrate?.([300, 100, 300]); } catch { /* ignore */ }

  // Web Audio (works on desktop and iOS after user has tapped the page)
  try {
    const c = getCtx();
    if (c.state === 'suspended') {
      c.resume().then(() => playTones(c));
    } else {
      playTones(c);
    }
  } catch { /* ignore */ }
}
