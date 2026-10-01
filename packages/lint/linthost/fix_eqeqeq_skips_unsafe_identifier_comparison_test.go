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
//
// @evidence contracts/testing.md#behavioral-verification eqeqeq reports left == right but leaves all bytes and the automatic edit count unchanged.
// @evidence contracts/testing.md#independent-expectations Unknown-typed operands can require coercion; the original source and zero applied edits are the independent no-autofix oracle.
// @evidence contracts/testing.md#distinguishing-cases This unsafe comparison complements the typeof and same-number-literal fixing cases; reporting is required so an inactive rule cannot pass.
// @evidence contracts/testing.md#execution-ownership TestFixEqeqeqSkipsUnsafeIdentifierComparison calls assertNoFixSnapshot, whose runFixSnapshot requires a finding and executes the disk applier in process.
func TestFixEqeqeqSkipsUnsafeIdentifierComparison(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "eqeqeq",
    "declare const left: unknown;\ndeclare const right: unknown;\nif (left == right) { JSON.stringify(left); }\n",
  )
}
