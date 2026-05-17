package linthost

import "testing"

// TestFixEqeqeqSkipsUnsafeIdentifierComparison verifies eqeqeq avoids unsafe autofix.
//
// A loose comparison between arbitrary identifiers can depend on JavaScript
// coercion. The rule should still report the diagnostic, but the fix command
// must not rewrite the operator automatically.
//
// 1. Parse a source file with `left == right`.
// 2. Run eqeqeq and apply any offered text edits.
// 3. Assert the source remains unchanged.
func TestFixEqeqeqSkipsUnsafeIdentifierComparison(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "eqeqeq",
    "declare const left: unknown;\ndeclare const right: unknown;\nif (left == right) { JSON.stringify(left); }\n",
  )
}
