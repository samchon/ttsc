package linthost

import "testing"

// TestRuleCorpusPromiseNoMultipleResolved verifies promise/no-multiple-resolved
// reports a second resolver call in one Promise executor.
//
// The native implementation is intentionally syntactic and catches the
// high-confidence straight-line case.
//
// 1. Enable promise/no-multiple-resolved.
// 2. Call resolve and then reject in the same executor body.
// 3. Assert the second resolver call is reported.
func TestRuleCorpusPromiseNoMultipleResolved(t *testing.T) {
	assertRuleCorpusCase(t, "promise/no-multiple-resolved.ts", "new Promise((resolve, reject) => {\n  resolve(1);\n  // expect: promise/no-multiple-resolved error\n  reject(new Error(\"already resolved\"));\n});\n")
}
