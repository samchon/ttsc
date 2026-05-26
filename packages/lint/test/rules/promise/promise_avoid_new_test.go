package linthost

import "testing"

// TestRuleCorpusPromiseAvoidNew verifies promise/avoid-new reports direct
// Promise construction.
//
// Direct constructors are reserved for adapter code in this policy family; the
// rule is intentionally separate from the core Promise executor rules.
//
// 1. Enable promise/avoid-new.
// 2. Construct a Promise directly.
// 3. Assert the constructor expression is reported.
func TestRuleCorpusPromiseAvoidNew(t *testing.T) {
	assertRuleCorpusCase(t, "promise/avoid-new.ts", "// expect: promise/avoid-new error\nnew Promise((resolve) => resolve(1));\n")
}
