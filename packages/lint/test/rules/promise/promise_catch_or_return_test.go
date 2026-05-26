package linthost

import "testing"

// TestRuleCorpusPromiseCatchOrReturn verifies promise/catch-or-return reports
// a floating then chain without catch.
//
// This pins the expression-statement branch, where the chain is neither
// returned nor awaited and has no terminal rejection handler.
//
// 1. Enable promise/catch-or-return.
// 2. Use a top-level then chain without catch.
// 3. Assert the statement is reported.
func TestRuleCorpusPromiseCatchOrReturn(t *testing.T) {
	assertRuleCorpusCase(t, "promise/catch-or-return.ts", "// expect: promise/catch-or-return error\nPromise.resolve(1).then((value) => value + 1);\n")
}
