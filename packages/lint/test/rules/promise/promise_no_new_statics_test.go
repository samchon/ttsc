package linthost

import "testing"

// TestRuleCorpusPromiseNoNewStatics verifies promise/no-new-statics reports
// construction of Promise static calls.
//
// Promise statics are functions, not constructors; using `new` changes intent
// and should be caught independently from direct Promise construction.
//
// 1. Enable promise/no-new-statics.
// 2. Construct Promise.resolve.
// 3. Assert the new expression is reported.
func TestRuleCorpusPromiseNoNewStatics(t *testing.T) {
	assertRuleCorpusCase(t, "promise/no-new-statics.ts", "// expect: promise/no-new-statics error\nnew Promise.resolve(1);\n")
}
