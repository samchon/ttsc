package linthost

import "testing"

// TestRuleCorpusPromiseNoNesting verifies promise/no-nesting reports nested
// promise chains inside promise callbacks.
//
// The case keeps the outer and inner chains on separate lines so the reported
// nested call is unambiguous.
//
// 1. Enable promise/no-nesting.
// 2. Nest a then chain inside another then handler.
// 3. Assert the inner chain is reported.
func TestRuleCorpusPromiseNoNesting(t *testing.T) {
	assertRuleCorpusCase(t, "promise/no-nesting.ts", "Promise.resolve(1).then(() => {\n  // expect: promise/no-nesting error\n  Promise.resolve(2).then((value) => value);\n});\n")
}
