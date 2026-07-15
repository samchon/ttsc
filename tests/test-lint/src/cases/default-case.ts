// Positive: a `switch` without a `default` clause and without a marker
// silently lets unhandled discriminants fall through with no value -- the
// rule reports.
function classify(kind: string): string {
  // expect: default-case error
  switch (kind) {
    case "a":
      return "letter-a";
    case "b":
      return "letter-b";
  }
  return "unknown";
}

// Negative: a `switch` that already carries a `default` clause is fine.
function describe(kind: string): string {
  switch (kind) {
    case "a":
      return "letter-a";
    default:
      return "unknown";
  }
}

// Negative: an empty `switch` has no clause to attach a marker to, so the
// rule skips it (upstream `if (!node.cases.length) return;`).
function ignoreEmpty(kind: string): void {
  switch (kind) {
  }
}

// Negative: a trailing `// no default` marker declares the omission
// intentional, so the rule stays silent.
function marked(kind: string): string {
  switch (kind) {
    case "a":
      return "letter-a";
    // no default
  }
  return "unknown";
}

JSON.stringify({
  classify: classify("a"),
  describe: describe("b"),
  marked: marked("a"),
});
