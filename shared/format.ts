/** Rounds a number to one decimal place, e.g. for a currency amount (12.345 -> 12.3). */
export function roundTo1dp(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Converts a 0..1 ratio to a percentage rounded to one decimal place (0.8333... -> 83.3). */
export function ratioToPercentage(ratio: number): number {
  return roundTo1dp(ratio * 100);
}
