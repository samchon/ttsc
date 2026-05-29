package linthost

import "testing"

// TestRuleCorpusUnicornNoNewArray verifies unicorn/no-new-array reports
// `new Array(...)` constructions.
//
// The single-numeric-argument form is the most common offender: it allocates
// a sparse array rather than a one-element array, which is the entire reason
// the upstream rule exists. The match is callee-identifier-text only, so
// argument count and type are not part of the contract.
//
// 1. Enable unicorn/no-new-array via an expect annotation.
// 2. Construct `new Array(3)` at the top level.
// 3. Assert the new-expression is reported.
func TestRuleCorpusUnicornNoNewArray(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-new-array.ts", "// expect: unicorn/no-new-array error\nconst a = new Array(3);\n")
}
