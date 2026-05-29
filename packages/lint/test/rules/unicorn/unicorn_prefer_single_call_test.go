package linthost

import "testing"

// TestRuleCorpusUnicornPreferSingleCall verifies unicorn/prefer-single-call
// reports two consecutive `xs.push(...)` statements that can be merged
// into one variadic call.
//
// The rule walks each `Block`, looks at consecutive expression
// statements, and matches when both wrap a `PropertyAccess` call sharing
// the same receiver text and same method name (`push`, `unshift`,
// `addEventListener`, `removeEventListener`). This fixture pins the
// `push` arm with a bare-identifier receiver so the receiver-text
// equality stays covered.
//
// 1. Enable unicorn/prefer-single-call via an expect annotation.
// 2. Issue two back-to-back `xs.push(...)` calls in the same block.
// 3. Assert the second statement is reported.
func TestRuleCorpusUnicornPreferSingleCall(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-single-call.ts", "const xs: number[] = [];\nxs.push(1);\n// expect: unicorn/prefer-single-call error\nxs.push(2);\n")
}
