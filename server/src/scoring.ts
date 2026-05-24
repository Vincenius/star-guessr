export function computeRoundScore(guess: number, actual: number, secondsRemaining: number): number {
  if (guess <= 0 || actual <= 0) return 0;
  const base = Math.max(0, Math.round(1000 - 400 * Math.abs(Math.log10(guess / actual))));
  const timeBonus = Math.round((Math.max(0, secondsRemaining) / 90) * 200);
  return base + timeBonus;
}

export function computeTotalScore(
  guesses: number[],
  stars: number[],
  secondsRemainingPerRound: number[]
): number {
  let total = 0;
  for (let i = 0; i < guesses.length; i++) {
    total += computeRoundScore(guesses[i], stars[i], secondsRemainingPerRound[i]);
  }
  return Math.min(total, 6000);
}
