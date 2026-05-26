package linthost

import "testing"

// TestRuleCorpusPromiseNoReturnInFinally verifies promise/no-return-in-finally
// reports returns inside promise finally callbacks.
//
// Returning from finally hides the settled value or rejection from the previous
// chain link.
//
// 1. Enable promise/no-return-in-finally.
// 2. Return a value from a finally callback.
// 3. Assert the return statement is reported.
func TestRuleCorpusPromiseNoReturnInFinally(t *testing.T) {
	assertRuleCorpusCase(t, "promise/no-return-in-finally.ts", "Promise.resolve(1).finally(() => {\n  // expect: promise/no-return-in-finally error\n  return 2;\n});\n")
}
