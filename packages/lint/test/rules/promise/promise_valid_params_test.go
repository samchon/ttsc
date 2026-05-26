package linthost

import "testing"

// TestRuleCorpusPromiseValidParams verifies promise/valid-params reports wrong
// argument counts for Promise APIs.
//
// Promise.all requires one iterable argument, so an empty call is always
// suspicious and can be detected without type information.
//
// 1. Enable promise/valid-params.
// 2. Call Promise.all with no arguments.
// 3. Assert the invalid call is reported.
func TestRuleCorpusPromiseValidParams(t *testing.T) {
	assertRuleCorpusCase(t, "promise/valid-params.ts", "// expect: promise/valid-params error\nPromise.all();\n")
}
