package linthost

import "testing"

// TestRuleCorpusUnicornExplicitLengthCheck verifies the rule reports a
// `.length` property access used as an `if` test.
//
// `if (xs.length) …` reads "is `xs` truthy" rather than "does `xs` have
// elements". The fixture pins the boolean-context branch: a
// `PropertyAccessExpression` whose `Name()` is `length` whose parent is
// the `Expression` slot of a `KindIfStatement`.
//
// 1. Enable unicorn/explicit-length-check via an expect annotation.
// 2. Write `if (xs.length) { … }` against a declared array.
// 3. Assert the property access is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies array length is used as implicit truthiness; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/explicit-length-check annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same length is explicitly compared to zero. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornExplicitLengthCheck is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornExplicitLengthCheck(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/explicit-length-check.ts", "declare const xs: number[];\nif (\n  // expect: unicorn/explicit-length-check error\n  xs.length\n) {\n  void 0;\n}\n")
  assertRuleSkipsSource(t, "unicorn/explicit-length-check", "declare const xs: number[]; if (xs.length > 0) { void 0; }\n")
}
