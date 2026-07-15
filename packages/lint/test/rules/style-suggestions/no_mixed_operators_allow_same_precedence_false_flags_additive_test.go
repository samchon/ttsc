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
