package linthost

import "testing"

// TestRuleCorpusPromisePreferAwaitToCallbacks verifies
// promise/prefer-await-to-callbacks reports callback-shaped function APIs.
//
// This pins the parameter-name branch, separate from direct callback calls.
//
// 1. Enable promise/prefer-await-to-callbacks.
// 2. Declare a function whose last parameter is callback.
// 3. Assert the callback parameter is reported.
func TestRuleCorpusPromisePreferAwaitToCallbacks(t *testing.T) {
	assertRuleCorpusCase(t, "promise/prefer-await-to-callbacks.ts", "// expect: promise/prefer-await-to-callbacks error\nfunction load(callback: () => void) {\n  void callback;\n}\n")
}
