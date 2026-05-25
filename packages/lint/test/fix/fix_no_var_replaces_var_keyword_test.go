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
func TestFixNoVarReplacesVarKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "noVar",
    "var legacy = 1;\nJSON.stringify(legacy);\n",
    "let legacy = 1;\nJSON.stringify(legacy);\n",
  )
}
