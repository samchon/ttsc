package linthost

import "testing"

// TestNoMixedOperatorsAllowsBitwiseBesideComparison verifies `a & b === c` is
// NOT flagged.
//
// `&` (bitwise) and `===` (comparison) sit in different default groups, so
// upstream does not report the mix. The rule is AST-only, so the parser-path
// harness never type-checks the (intentionally type-invalid) `&` on a boolean.
//
// 1. Write `const x = a & b === c;` (parses as `a & (b === c)`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Permits bitwise & next to equality under default operator groups.
// @evidence contracts/testing.md#independent-expectations The supported default groups do not compare bitwise with equality, so literal zero findings follows group membership rather than a blanket precedence ban.
// @evidence contracts/testing.md#distinguishing-cases Cross-group negative complements within-group shift/bitwise and relational/equality positives.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's exact authored source through the enabled engine rule; this Test owns its zero-finding comparison. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsAllowsBitwiseBesideComparison(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a & b === c;\n",
  )
}
