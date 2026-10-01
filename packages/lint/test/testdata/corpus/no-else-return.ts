// no-else-return corpus (issue #598). Only a `return` makes the matching
// `else` redundant; `throw` / `break` / `continue` do not, and `allowElseIf`
// (default true) leaves a `return` + `else if` chain alone.

// Invalid: the `if` branch returns, so the plain `else` block is redundant.
function describe(kind: string): string {
  if (kind === "a") {
    return "letter-a";
    // expect: no-else-return error
  } else {
    return "other";
  }
}

// Invalid: a three-branch `return` chain reports exactly once — on the
// terminal `else`, not once per link.
function grade(score: number): string {
  if (score >= 90) return "A";
  else if (score >= 80) return "B";
  // expect: no-else-return error
  else return "C";
}

// Valid: `allowElseIf` (default true) leaves a `return` + `else if` chain
// that ends without a plain `else` alone.
function classifySign(n: number): string {
  if (n > 0) {
    return "positive";
  } else if (n < 0) {
    return "negative";
  }
  return "zero";
}

// Valid: `throw` is not a `return`, so the `else` is load-bearing.
function requirePositive(n: number): number {
  if (n <= 0) {
    throw new Error("non-positive");
  } else {
    return n;
  }
}

// Valid: a loop `break` is not a `return`.
function firstBreakIndex(values: boolean[]): number {
  let last = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i]) {
      break;
    } else {
      last = i;
    }
  }
  return last;
}

// Valid: a loop `continue` is not a `return`.
function countFalsy(values: boolean[]): number {
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i]) {
      continue;
    } else {
      count += 1;
    }
  }
  return count;
}

// Negative: the `if` branch does not return, so the `else` is load-bearing.
function classify(n: number): string {
  let label: string;
  if (n > 0) {
    label = "positive";
  } else {
    label = "non-positive";
  }
  return label;
}

JSON.stringify({
  describe: describe("a"),
  grade: grade(95),
  classifySign: classifySign(1),
  requirePositive: requirePositive(1),
  firstBreakIndex: firstBreakIndex([true]),
  countFalsy: countFalsy([false]),
  classify: classify(1),
});
