// Short two-note "ding-dong" synthesized with the Web Audio API, so there's
// no audio file to bundle. Electron's default autoplay policy lets this play
// without a prior click.

let ctx: AudioContext | null = null;

export function playChime(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime + 0.02;
    const notes = [
      { freq: 880, at: 0 }, // A5
      { freq: 659.25, at: 0.18 }, // E5
    ];

    for (const { freq, at } of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;

      // Quick attack, exponential decay — a soft bell rather than a beep.
      const t = start + at;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    }
  } catch (err) {
    // Audio is a nicety; never let it break the notification itself.
    console.warn("Couldn't play notification chime:", err);
  }
}
