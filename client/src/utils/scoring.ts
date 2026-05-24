export function computeRoundScore(guess: number, actual: number, secondsRemaining: number): number {
  if (guess <= 0 || actual <= 0) return 0;
  const base = Math.max(0, Math.round(1000 - 400 * Math.abs(Math.log10(guess / actual))));
  const timeBonus = Math.round((Math.max(0, secondsRemaining) / 90) * 200);
  return base + timeBonus;
}

export function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
