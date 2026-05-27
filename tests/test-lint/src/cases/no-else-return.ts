// Positive: the `if` branch already ends in `return`, so the `else`
// block adds nothing — flatten its body up into the function scope.
function describe(kind: string): string {
  if (kind === "a") {
    return "letter-a";
    // expect: no-else-return error
  } else {
    return "other";
  }
}

// Negative: the `if` branch does not terminate, so the `else` is load-bearing.
function classify(n: number): string {
  let label: string;
  if (n > 0) {
    label = "positive";
  } else {
    label = "non-positive";
  }
  return label;
}

JSON.stringify({ describe: describe("a"), classify: classify(1) });
