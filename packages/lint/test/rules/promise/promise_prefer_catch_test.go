package linthost

import "testing"

// TestRuleCorpusPromisePreferCatch verifies promise/prefer-catch reports the
// second rejection-handler argument to then().
//
// The handler is clearer and easier to compose when spelled as a following
// catch() call.
//
// 1. Enable promise/prefer-catch.
// 2. Pass a rejection handler as the second then argument.
// 3. Assert that rejection handler is reported.
func TestRuleCorpusPromisePreferCatch(t *testing.T) {
	assertRuleCorpusCase(t, "promise/prefer-catch.ts", "Promise.resolve(1).then(\n  (value) => value,\n  // expect: promise/prefer-catch error\n  (error) => console.error(error),\n);\n")
}
