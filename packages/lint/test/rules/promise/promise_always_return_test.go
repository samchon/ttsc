package linthost

import "testing"

// TestRuleCorpusPromiseAlwaysReturn verifies promise/always-return reports a
// then callback that neither returns nor throws.
//
// The promise plugin family is namespaced, so this also pins slash-bearing
// expectation parsing in the Go corpus harness.
//
// 1. Enable the namespaced promise rule through an expect annotation.
// 2. Run a then callback with a block body and no return.
// 3. Assert the callback is reported.
func TestRuleCorpusPromiseAlwaysReturn(t *testing.T) {
	assertRuleCorpusCase(t, "promise/always-return.ts", "// expect: promise/always-return error\nPromise.resolve(1).then(() => {\n  console.log(\"side effect\");\n});\n")
}
