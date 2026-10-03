// Positive: the `default` clause appears before the explicit `case`
// labels, so a fall-through from `default` lands in `case "b"` — almost
// always a misordering rather than the intent.
function classify(kind: string): string {
  switch (kind) {
    // expect: default-case-last error
    default:
      return "unknown";
    case "a":
      return "letter-a";
    case "b":
      return "letter-b";
  }
}

// Negative: the `default` clause already trails every `case` label, which
// is the conventional ordering and what the rule wants to enforce.
function describe(kind: string): string {
  switch (kind) {
    case "a":
      return "letter-a";
    case "b":
      return "letter-b";
    default:
      return "unknown";
  }
}

JSON.stringify({ classify: classify("a"), describe: describe("b") });
