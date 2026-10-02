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
// the same `return` + `else if` shape (braced there, unbraced here) is silent
// under the default (`allowElseIf: true`) but reports under
// `allowElseIf: false`, upstream's
// `checkIfWithElse` path. The single finding lands on the `else if` node.
//
// 1. Configure no-else-return with `{"allowElseIf": false}`.
// 2. Lint `if (a) return 1; else if (b) return 2;` with no final else.
// 3. Assert exactly one finding spanning the `else if`'s `if (b) return 2;`.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires one finding at the exact second-if source range when allowElseIf is false, including rule/error identity.
// @evidence contracts/testing.md#independent-expectations The authored explicit false option independently withdraws the default chain exemption; the literal marker supplies the expected complete range.
// @evidence contracts/testing.md#distinguishing-cases The otherwise allowed else-if chain reports under false; AllowsElseIfReturnChain supplies the default-options clean twin.
// @evidence contracts/testing.md#execution-ownership TestNoElseReturnAllowElseIfFalseReportsElseIf is selected in the shared Go unit population. It calls runRuleFindingsSnapshot with the authored allowElseIf JSON and compares positions directly to the source marker. No installed consumer, native artifact build or real product host runs.
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
  if findings[0].Rule != "no-else-return" || findings[0].Severity != SeverityError { t.Fatalf("unexpected rule/severity: %+v", findings[0]) }
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
