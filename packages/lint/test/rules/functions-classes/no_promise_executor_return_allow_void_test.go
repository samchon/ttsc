package linthost

import (
  "encoding/json"
  "slices"
  "sort"
  "strings"
  "testing"
)

// TestNoPromiseExecutorReturnAllowVoid verifies the allowVoid option accepts
// only an explicit unary void return.
//
// A value can have the TypeScript `void` type without using the `void`
// operator. The upstream contract deliberately recognizes the syntax, not the
// inferred type, so `undefined` and sequence expressions remain reportable
// while parenthesized unary void expressions are accepted.
//
// 1. Enable allowVoid and exercise concise and explicit executor returns.
// 2. Pair unary void positives with undefined and sequence-expression negatives.
// 3. Assert bare returns and nested-function returns remain silent.
func TestNoPromiseExecutorReturnAllowVoid(t *testing.T) {
  source := `declare function consume(value: unknown): void;

new Promise(() => void consume(1));
new Promise(() => (void consume(2)));
new Promise(() => {
  return void consume(3);
});
new Promise(function () {
  return (void consume(4));
});
new Promise(() => undefined); // diagnostic
new Promise(() => {
  return undefined; // diagnostic
});
new Promise(() => {
  return (consume(5), void consume(6)); // diagnostic
});
new Promise(() => {
  function nested() {
    return 6;
  }
  consume(nested);
  return;
});
`
  expectedLines := make([]int, 0)
  for index, line := range strings.Split(source, "\n") {
    if strings.Contains(line, "// diagnostic") {
      expectedLines = append(expectedLines, index+1)
    }
  }

  _, _, findings := runRuleFindingsSnapshot(
    t,
    "no-promise-executor-return",
    source,
    json.RawMessage(`{"allowVoid":true}`),
  )
  actualLines := make([]int, 0, len(findings))
  for _, finding := range findings {
    if finding.Pos < 0 || finding.Pos > len(source) {
      t.Fatalf("finding position %d is outside source length %d", finding.Pos, len(source))
    }
    actualLines = append(actualLines, strings.Count(source[:finding.Pos], "\n")+1)
  }
  sort.Ints(actualLines)
  if !slices.Equal(actualLines, expectedLines) {
    t.Fatalf("diagnostic lines mismatch: want %v, got %v", expectedLines, actualLines)
  }
}
