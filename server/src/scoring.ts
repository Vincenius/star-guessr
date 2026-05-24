export function computeRoundScore(guess: number, actual: number): number {
  if (guess <= 0 || actual <= 0) return 0;
  return Math.max(0, Math.round(1000 - 400 * Math.abs(Math.log10(guess / actual))));
}

export function computeTotalScore(guesses: number[], stars: number[]): number {
  let total = 0;
  for (let i = 0; i < guesses.length; i++) {
    total += computeRoundScore(guesses[i], stars[i]);
  }
  return Math.min(total, 5000);
}
