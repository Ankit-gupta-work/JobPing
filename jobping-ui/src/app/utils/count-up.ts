// Animates a numeric value from `from` to `to` over `durationMs`, calling
// `onUpdate` on each frame. Returns a cancel function.
export function countUp(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (value: number) => void,
): () => void {
  if (from === to) {
    onUpdate(to);
    return () => {};
  }

  const startTime = performance.now();
  let frame: number;

  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    onUpdate(Math.round(from + (to - from) * eased));
    if (t < 1) {
      frame = requestAnimationFrame(step);
    }
  };
  frame = requestAnimationFrame(step);

  return () => cancelAnimationFrame(frame);
}
