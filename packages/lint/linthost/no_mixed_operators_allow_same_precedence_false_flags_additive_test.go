package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoMixedOperatorsAllowSamePrecedenceFalseFlagsAdditive verifies that with
// `allowSamePrecedence: false`, the otherwise-silent `a + b - c` is flagged.
//
// `+` and `-` share the ARITHMETIC group and the additive precedence, so the
// default (allowSamePrecedence on) leaves them alone. Turning the option off
// removes that allowance and upstream reports both tokens, proving the option is
// honored rather than hard-coded to its default.
//
// 1. Write `const x = a + b - c;` and configure allowSamePrecedence:false.
// 2. Run no-mixed-operators through the engine with that option blob.
// 3. Assert exactly two findings spanning `+` and `-`.
//
// @evidence contracts/testing.md#behavioral-verification Reports both + and - tokens when the same-precedence allowance is false.
// @evidence contracts/testing.md#independent-expectations The false option removes the additive allowance; ESLint reports both operators and the authored + and - markers independently define the expected ranges.
// @evidence contracts/testing.md#distinguishing-cases Same-precedence +/- positive complements default same-precedence allowances.
// @evidence contracts/testing.md#execution-ownership runRuleFindingsSnapshot executes the false option and literal source; this Test directly compares two diagnostic ranges in the lint Go unit process.
func TestNoMixedOperatorsAllowSamePrecedenceFalseFlagsAdditive(t *testing.T) {
  const source = "const x = a + b - c;\n"
  _, _, findings := runRuleFindingsSnapshot(
    t,
    "no-mixed-operators",
    source,
    json.RawMessage(`{"allowSamePrecedence":false}`),
  )
  if len(findings) != 2 {
    t.Fatalf("no-mixed-operators: want 2 findings, got %d (%+v)", len(findings), findings)
  }
  for index, marker := range []string{"+", "-"} {
    start := strings.Index(source, marker)
    if finding := findings[index]; finding.Pos != start || finding.End != start+len(marker) {
      t.Errorf("operator %q: want [%d,%d), got [%d,%d)", marker, start, start+len(marker), finding.Pos, finding.End)
    }
  }
}
