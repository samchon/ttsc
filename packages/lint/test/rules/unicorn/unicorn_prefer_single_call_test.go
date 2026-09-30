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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies successive push calls target the same receiver; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-single-call annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; one push call carries both appended values. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferSingleCall is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferSingleCall(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-single-call.ts", "const xs: number[] = [];\nxs.push(1);\n// expect: unicorn/prefer-single-call error\nxs.push(2);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-single-call", "const xs: number[] = []; xs.push(1,2);\n")
}
