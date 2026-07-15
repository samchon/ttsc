package linthost

import "testing"

// TestNoMixedOperatorsAllowsBitwiseBesideComparison verifies `a & b === c` is
// NOT flagged.
//
// The issue #611 regression shield names this cross-group pair as a negative:
// `&` (bitwise) and `===` (comparison) sit in different default groups, so
// upstream does not report the mix. The rule is AST-only, so the parser-path
// harness never type-checks the (intentionally type-invalid) `&` on a boolean.
//
// 1. Write `const x = a & b === c;` (parses as `a & (b === c)`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert zero findings.
func TestNoMixedOperatorsAllowsBitwiseBesideComparison(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a & b === c;\n",
  )
}
