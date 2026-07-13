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
func TestFixPreferAsConstSkipsNullLiteralAssertion(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/prefer-as-const",
    "const value = null as null;\nJSON.stringify(value);\n",
  )
}
