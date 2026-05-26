package linthost

import "testing"

// TestRuleCorpusPromiseNoReturnWrap verifies promise/no-return-wrap reports
// redundant Promise.resolve wrapping inside a promise callback.
//
// The callback already returns into a promise chain, so wrapping the value adds
// noise without changing the result.
//
// 1. Enable promise/no-return-wrap.
// 2. Return Promise.resolve from a then handler.
// 3. Assert the wrapped return is reported.
func TestRuleCorpusPromiseNoReturnWrap(t *testing.T) {
	assertRuleCorpusCase(t, "promise/no-return-wrap.ts", "Promise.resolve(1).then(() => {\n  // expect: promise/no-return-wrap error\n  return Promise.resolve(2);\n});\n")
}
