package linthost

import "testing"

// TestRuleCorpusPromisePreferAwaitToThen verifies promise/prefer-await-to-then
// reports promise chain methods.
//
// The rule is intentionally syntax-only: any then/catch/finally chain is a
// candidate for async/await refactoring.
//
// 1. Enable promise/prefer-await-to-then.
// 2. Use a then chain.
// 3. Assert the chain call is reported.
func TestRuleCorpusPromisePreferAwaitToThen(t *testing.T) {
	assertRuleCorpusCase(t, "promise/prefer-await-to-then.ts", "// expect: promise/prefer-await-to-then error\nPromise.resolve(1).then((value) => value);\n")
}
