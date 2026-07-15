package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoMixedOperatorsCustomGroupsTernaryFlagsLogical verifies that a custom
// group containing "?:" flags a logical condition mixed with a ternary.
//
// The ternary operator is absent from the default groups, so `a && b ? c : d`
// is silent by default (see the by-default negative twin). Adding "?:" to a
// group alongside the logical operators makes the ConditionalExpression parent
// eligible, and upstream reports the mix on the condition. This pins the
// conditional-parent branch and custom-group opt-in together.
//
// 1. Write `const x = a && b ? c : d;` and configure groups with "?:".
// 2. Run no-mixed-operators with that option blob.
// 3. Assert exactly one finding spanning the condition `a && b`.
func TestNoMixedOperatorsCustomGroupsTernaryFlagsLogical(t *testing.T) {
  const source = "const x = a && b ? c : d;\n"
  const marker = "a && b"
  _, _, findings := runRuleFindingsSnapshot(
    t,
    "no-mixed-operators",
    source,
    json.RawMessage(`{"groups":[["&&","||","?:"]]}`),
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
