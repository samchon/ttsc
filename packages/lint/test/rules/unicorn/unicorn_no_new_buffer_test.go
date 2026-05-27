package linthost

import "testing"

// TestRuleCorpusUnicornNoNewBuffer verifies unicorn/no-new-buffer reports
// `new Buffer(...)` constructions.
//
// This fixture pins the identifier-text branch on the most common argument
// shape — an integer size literal — and locks the contract that argument
// arity and type are not part of the match. The rule reports purely on the
// callee identifier text, mirroring `promise/avoid-new`'s `identifierText`
// gate against the constructor name.
//
// 1. Enable unicorn/no-new-buffer via an expect annotation.
// 2. Construct `new Buffer(10)` at the top level.
// 3. Assert the new-expression is reported.
func TestRuleCorpusUnicornNoNewBuffer(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-new-buffer.ts", "// expect: unicorn/no-new-buffer error\nconst b = new Buffer(10);\n")
}
