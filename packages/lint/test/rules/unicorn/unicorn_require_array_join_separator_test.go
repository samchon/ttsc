package linthost

import "testing"

// TestRuleCorpusUnicornRequireArrayJoinSeparator verifies
// unicorn/require-array-join-separator reports a zero-argument
// `.join()` call on an array literal.
//
// The rule visits every `CallExpression` and matches purely on the
// property-access callee's method name plus the zero-arg shape; the
// receiver is not type-checked, so an inline array literal is enough
// to exercise the rule's only firing branch.
//
// 1. Enable unicorn/require-array-join-separator via an expect annotation.
// 2. Call `.join()` on an inline array literal with no arguments.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies join omits its separator argument; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/require-array-join-separator annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; join explicitly supplies the intended separator. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornRequireArrayJoinSeparator is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornRequireArrayJoinSeparator(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/require-array-join-separator.ts", "// expect: unicorn/require-array-join-separator error\nconst s = [1, 2, 3].join();\n")
  assertRuleSkipsSource(t, "unicorn/require-array-join-separator", "const s = [1,2,3].join(\",\");\n")
}
