let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(freq: number, durationMs: number, type: OscillatorType, gainPeak = 0.06, delayMs = 0) {
  const ctx = getContext();
  if (!ctx) return;

  const start = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.02);
}

export function playMoveSound(mark: 'X' | 'O', muted: boolean) {
  if (muted) return;
  playTone(mark === 'X' ? 520 : 392, 90, 'triangle', 0.055);
}

export function playWinSound(muted: boolean) {
  if (muted) return;
  playTone(523.25, 130, 'sine', 0.06, 0);
  playTone(659.25, 130, 'sine', 0.06, 90);
  playTone(783.99, 220, 'sine', 0.07, 180);
}

export function playDrawSound(muted: boolean) {
  if (muted) return;
  playTone(392, 120, 'sine', 0.045, 0);
  playTone(349.23, 180, 'sine', 0.045, 110);
}

export function playRestoreSound(muted: boolean) {
  if (muted) return;
  playTone(620, 75, 'sine', 0.045, 0);
  playTone(466, 110, 'sine', 0.05, 65);
}
