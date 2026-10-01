// expect: complexity error
function tooComplex(input: number): string {
  // Base complexity is 1. The body below adds 24 more branching points
  // for a final score of 25 — comfortably above the configured limit
  // of 20.
  if (input === 0) return "zero";
  if (input === 1) return "one";
  if (input === 2) return "two";
  if (input === 3) return "three";
  if (input === 4) return "four";
  if (input === 5) return "five";
  if (input === 6) return "six";
  if (input === 7) return "seven";
  if (input === 8) return "eight";
  if (input === 9) return "nine";
  if (input === 10) return "ten";
  if (input > 100 && input < 200) return "hundreds";
  if (input > 200 || input < -200) return "extreme";
  if (input === null || input === undefined) return "missing";
  const tag = input > 0 ? "positive" : "negative";
  const fallback = input ?? 0;
  switch (fallback) {
    case 11:
      return "eleven";
    case 12:
      return "twelve";
    case 13:
      return "thirteen";
    case 14:
      return "fourteen";
    default:
      break;
  }
  try {
    return tag + String(fallback);
  } catch {
    return "error";
  }
}

// Negative: stays under the limit, so the rule must not fire.
function simple(value: number): number {
  if (value < 0) return 0;
  return value + 1;
}

JSON.stringify({
  tooComplex: tooComplex(7),
  simple: simple(2),
});
