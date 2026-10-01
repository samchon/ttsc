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
// removes that allowance and upstream reports the mix — proving the option is
// honored rather than hard-coded to its default.
//
// 1. Write `const x = a + b - c;` and configure allowSamePrecedence:false.
// 2. Run no-mixed-operators through the engine with that option blob.
// 3. Assert exactly one finding spanning the inner `a + b`.
//
// @evidence contracts/testing.md#behavioral-verification Reports a+b nested under subtraction when same-precedence allowance is false, with exact inner span.
// @evidence contracts/testing.md#independent-expectations The explicit false option changes the default group policy; literal a+b source marker independently defines the one expected range.
// @evidence contracts/testing.md#distinguishing-cases Same-precedence +/- positive complements default same-precedence allowances.
// @evidence contracts/testing.md#execution-ownership runRuleFindingsSnapshot executes this entry's exact custom option/source pair. The Test directly checks one finding and compares its Pos/End to the independently authored inner-expression marker. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsAllowSamePrecedenceFalseFlagsAdditive(t *testing.T) {
  const source = "const x = a + b - c;\n"
  const marker = "a + b"
  _, _, findings := runRuleFindingsSnapshot(
    t,
    "no-mixed-operators",
    source,
    json.RawMessage(`{"allowSamePrecedence":false}`),
  )
  if len(findings) != 1 {
    t.Fatalf("no-mixed-operators: want 1 finding, got %d (%+v)", len(findings), findings)
  }
  start := strings.Index(source, marker)
  if findings[0].Pos != start || findings[0].End != start+len(marker) {
    t.Fatalf(
      "no-mixed-operators: finding range: want [%d,%d) %q, got [%d,%d)",
      start, start+len(marker), marker, findings[0].Pos, findings[0].End,
    )
  }
}
