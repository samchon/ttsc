package linthost

import "testing"

// TestRuleCorpusPromiseNoNative verifies promise/no-native reports implicit
// global Promise use.
//
// This preserves eslint-plugin-promise's ES5 environment policy without
// requiring the TypeScript checker or scope graph.
//
// 1. Enable promise/no-native.
// 2. Use Promise.resolve without declaring Promise locally.
// 3. Assert the global Promise use is reported once.
func TestRuleCorpusPromiseNoNative(t *testing.T) {
	assertRuleCorpusCase(t, "promise/no-native.ts", "// expect: promise/no-native error\nPromise.resolve(1);\n")
}
