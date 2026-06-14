// Plays a two-tone "ding ding" using Web Audio API — no audio file needed.
export function playCodeArrivedSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const play = (freq: number, startAt: number, duration: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startAt);

      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.4, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

      osc.start(startAt);
      osc.stop(startAt + duration);
    };

    const t = ctx.currentTime;
    play(880, t,        0.18); // first ding  (A5)
    play(1108, t + 0.2, 0.22); // second ding (C#6) — slightly higher
  } catch {
    // Web Audio not supported — silently skip
  }
}
