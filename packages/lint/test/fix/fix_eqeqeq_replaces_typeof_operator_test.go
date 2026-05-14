package main

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
func TestFixEqeqeqReplacesTypeofOperator(t *testing.T) {
  assertFixSnapshot(
    t,
    "eqeqeq",
    "declare const value: unknown;\nif (typeof value == \"string\") { JSON.stringify(value); }\n",
    "declare const value: unknown;\nif (typeof value === \"string\") { JSON.stringify(value); }\n",
  )
}
