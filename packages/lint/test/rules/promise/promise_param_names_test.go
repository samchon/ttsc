package linthost

import "testing"

// TestRuleCorpusPromiseParamNames verifies promise/param-names reports
// misnamed Promise executor parameters.
//
// The first parameter is canonical so the test isolates the reject-name branch.
//
// 1. Enable promise/param-names.
// 2. Name the second executor parameter `fail`.
// 3. Assert the second parameter is reported.
func TestRuleCorpusPromiseParamNames(t *testing.T) {
	assertRuleCorpusCase(t, "promise/param-names.ts", "new Promise((resolve,\n  // expect: promise/param-names error\n  fail) => fail(new Error(\"x\")));\n")
}
