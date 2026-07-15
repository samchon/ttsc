package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoElseReturnAllowElseIfFalseReportsElseIf verifies that `allowElseIf:
// false` also flags an `else if` after a returning `if`.
//
// Negative twin, one property away, of TestNoElseReturnAllowsElseIfReturnChain:
// the identical `return` + `else if` shape is silent under the default
// (`allowElseIf: true`) but reports under `allowElseIf: false`, upstream's
// `checkIfWithElse` path. The single finding lands on the `else if` node.
//
// 1. Configure no-else-return with `{"allowElseIf": false}`.
// 2. Lint `if (a) return 1; else if (b) return 2;` with no final else.
// 3. Assert exactly one finding spanning the `else if`'s `if (b) return 2;`.
func TestNoElseReturnAllowElseIfFalseReportsElseIf(t *testing.T) {
  source := `declare const a: boolean;
declare const b: boolean;
function pick(): number {
  if (a) return 1;
  else if (b) return 2;
  return 3;
}
JSON.stringify(pick);
`
  _, _, findings := runRuleFindingsSnapshot(
    t,
    "no-else-return",
    source,
    json.RawMessage(`{"allowElseIf":false}`),
  )
  if len(findings) != 1 {
    t.Fatalf("allowElseIf:false: want 1 finding, got %d (%+v)", len(findings), findings)
  }
  marker := "if (b) return 2;"
  start := strings.Index(source, marker)
  if findings[0].Pos != start || findings[0].End != start+len(marker) {
    t.Fatalf(
      "range: want [%d,%d) %q, got [%d,%d)",
      start,
      start+len(marker),
      marker,
      findings[0].Pos,
      findings[0].End,
    )
  }
}
