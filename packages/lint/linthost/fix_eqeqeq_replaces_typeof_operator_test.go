package linthost

import "testing"

// TestFixEqeqeqReplacesTypeofOperator verifies eqeqeq safe typeof autofix output.
//
// ESLint treats `typeof value == "string"` as safe to fix because `typeof`
// always returns a string. The native fixer mirrors that branch and should
// replace only the equality operator token.
//
// 1. Parse a source file with a loose typeof comparison.
// 2. Apply the eqeqeq finding's text edit through the disk-backed fixer.
// 3. Assert `==` changed to `===` without changing surrounding spaces.
//
// @evidence contracts/testing.md#behavioral-verification eqeqeq fixes typeof value == string to === without changing the branch body or spacing.
// @evidence contracts/testing.md#independent-expectations The authored expected source relies on typeof returning a string, so strict comparison preserves this branch independently of fixer computation.
// @evidence contracts/testing.md#distinguishing-cases The safe typeof comparison differs from arbitrary identifier coercion; the latter withholds automatic edits in TestFixEqeqeqSkipsUnsafeIdentifierComparison, while suggestion semantics have a separate entry.
// @evidence contracts/testing.md#execution-ownership TestFixEqeqeqReplacesTypeofOperator calls assertFixSnapshot for eqeqeq, applying real Engine edits to the temporary file.
func TestFixEqeqeqReplacesTypeofOperator(t *testing.T) {
  assertFixSnapshot(
    t,
    "eqeqeq",
    "declare const value: unknown;\nif (typeof value == \"string\") { JSON.stringify(value); }\n",
    "declare const value: unknown;\nif (typeof value === \"string\") { JSON.stringify(value); }\n",
  )
}
