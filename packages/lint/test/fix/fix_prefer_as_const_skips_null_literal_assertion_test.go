package linthost

import "testing"

// TestFixPreferAsConstSkipsNullLiteralAssertion verifies preferAsConst ignores `null as null`.
//
// A `null` in type position surfaces upstream as `TSNullKeyword`, not
// `TSLiteralType`, so the upstream rule never reports `null as null`. The
// tsgo parser wraps the same annotation in a LiteralType node, which the
// rule previously matched by source text; this pins the corrected boundary.
//
// 1. Parse a source file with `null as null`.
// 2. Run preferAsConst with the engine.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification prefer-as-const emits no finding for null as null.
// @evidence contracts/testing.md#independent-expectations Literal null keyword inputs and zero findings follow the supported non-literal-type upstream boundary.
// @evidence contracts/testing.md#distinguishing-cases null differs from the matching string-literal positive case.
// @evidence contracts/testing.md#execution-ownership TestFixPreferAsConstSkipsNullLiteralAssertion calls assertRuleSkipsSource on its null fixture.
func TestFixPreferAsConstSkipsNullLiteralAssertion(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/prefer-as-const",
    "const value = null as null;\nJSON.stringify(value);\n",
  )
}
