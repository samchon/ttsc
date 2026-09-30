package linthost

import "testing"

// TestFixNoVarReplacesVarKeyword verifies noVar autofix output.
//
// The noVar fixer is intentionally token-scoped: it should replace only the
// declaration keyword and leave declarations, spacing, and trailing code
// untouched.
//
// 1. Parse a source file with one `var` declaration.
// 2. Apply the noVar finding's text edit through the disk-backed fixer.
// 3. Assert only `var` changed to `let`.
//
// @evidence contracts/testing.md#behavioral-verification no-var replaces only the var token of legacy, retaining its initializer and trailing call.
// @evidence contracts/testing.md#independent-expectations Literal let legacy output detects oversized or missing edits without computing expected bytes from the fixer.
// @evidence contracts/testing.md#distinguishing-cases The plain single binding is the minimal positive arm; the family separately retains unsafe scope/capture/redeclaration cases.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesVarKeyword calls assertFixSnapshot for its legacy source and actual applyFindingFixes path.
func TestFixNoVarReplacesVarKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "var legacy = 1;\nJSON.stringify(legacy);\n",
    "let legacy = 1;\nJSON.stringify(legacy);\n",
  )
}
