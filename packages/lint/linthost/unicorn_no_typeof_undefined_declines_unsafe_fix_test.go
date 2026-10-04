package linthost

import (
  "strings"
  "testing"
)

// TestUnicornNoTypeofUndefinedDeclinesUnsafeFix verifies the rule still reports
// the ASI-hazard shapes but attaches no autofix, so the fix applier leaves the
// source untouched.
//
// Removing typeof before an array-leading operand can join it to a preceding
// expression. Removing typeof across a line break can also change ASI. The
// native fix builder rejects these two shapes, so both diagnostics must remain
// while neither carries an automatic fix and disk source stays unchanged.
//
//  1. Lint a source stacking an array-literal operand and a line-split operand,
//     both bound so the global guard does not pre-empt the report.
//  2. Run the disk-backed fix applier.
//  3. Assert findings exist but nothing was rewritten.
//
// @evidence contracts/testing.md#behavioral-verification Exact authored typeof keyword positions require both diagnostics with no automatic fix; assertNoFixSnapshot additionally requires no applied edits and unchanged disk source.
// @evidence contracts/testing.md#independent-expectations The original authored source is the no-edit oracle under the supported conservative fix policy.
// @evidence contracts/testing.md#distinguishing-cases An array-leading operand and a typeof/operand line split each require their own diagnostic without an automatic fix.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoTypeofUndefinedDeclinesUnsafeFix is a discoverable Go unit host; owning checker-backed engine and disk-backed fix applier operations run its literal fixtures in the shared process without installation, native builds or product children. Local table/helper failures retain the source, expected replacement or option payload identity.
func TestUnicornNoTypeofUndefinedDeclinesUnsafeFix(t *testing.T) {
  source := `declare const items: unknown[];
declare const value: { deep: unknown };

typeof [items] === "undefined";
typeof
value.deep === "undefined";
`
  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/no-typeof-undefined", source, nil)
  want := map[int]bool{
    strings.Index(source, `typeof [items] === "undefined"`): true,
    strings.Index(source, "typeof\nvalue.deep === \"undefined\""): true,
  }
  if len(findings) != len(want) {
    t.Fatalf("expected both ASI-sensitive comparisons, got %+v", findings)
  }
  for _, finding := range findings {
    target := source[finding.Pos:finding.End]
    if !want[finding.Pos] || target != "typeof" || len(finding.Fix) != 0 {
      t.Fatalf("expected a distinct authored typeof keyword without an automatic fix, got %q: %+v", target, finding)
    }
    delete(want, finding.Pos)
  }
  assertNoFixSnapshot(t, "unicorn/no-typeof-undefined", source)
}
