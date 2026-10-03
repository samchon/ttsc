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
// eligible, and upstream reports the logical token and question token. This pins the
// conditional-parent branch and custom-group opt-in together.
//
// 1. Write `const x = a && b ? c : d;` and configure groups with "?:".
// 2. Run no-mixed-operators with that option blob.
// 3. Assert exactly two findings spanning `&&` and `?`.
//
// @evidence contracts/testing.md#behavioral-verification Reports the && and question tokens when the custom group includes logical and conditional operators.
// @evidence contracts/testing.md#independent-expectations The authored group creates the policy pair; ESLint reports both operators using the question token for ?:, and literal markers independently determine both ranges.
// @evidence contracts/testing.md#distinguishing-cases The same source stays clean under defaults in the ternary-beside-logical sibling.
// @evidence contracts/testing.md#execution-ownership runRuleFindingsSnapshot executes this entry's custom option/source pair, and this Test compares both token ranges directly in the lint Go unit process.
func TestNoMixedOperatorsCustomGroupsTernaryFlagsLogical(t *testing.T) {
  const source = "const x = a && b ? c : d;\n"
  _, _, findings := runRuleFindingsSnapshot(
    t,
    "no-mixed-operators",
    source,
    json.RawMessage(`{"groups":[["&&","||","?:"]]}`),
  )
  if len(findings) != 2 {
    t.Fatalf("no-mixed-operators: want 2 findings, got %d (%+v)", len(findings), findings)
  }
  for index, marker := range []string{"&&", "?"} {
    start := strings.Index(source, marker)
    if finding := findings[index]; finding.Pos != start || finding.End != start+len(marker) {
      t.Errorf("operator %q: want [%d,%d), got [%d,%d)", marker, start, start+len(marker), finding.Pos, finding.End)
    }
  }
}
