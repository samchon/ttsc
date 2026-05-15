package main

import "testing"

// TestFormatPrintWidthSkipsShortObjectLiteral verifies format/print-width
// abstains when the flat form already fits the configured budget.
//
// "No diff → no edit" is the load-bearing invariant that keeps
// `ttsc format` idempotent. A rule that emitted an edit on every visit
// (even a noop edit) would either churn the cascade or expand into
// overlapping edits with other format rules. The case pins the abstain
// branch by feeding a short object that already conforms.
//
//  1. Configure default printWidth=80.
//  2. Feed `const x = { a: 1 };`.
//  3. Assert the rule reports zero findings — the rule has nothing to
//     say about a conforming literal.
func TestFormatPrintWidthSkipsShortObjectLiteral(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = { a: 1 };\n",
  )
}
