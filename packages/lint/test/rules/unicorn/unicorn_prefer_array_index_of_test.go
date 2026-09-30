package linthost

import "testing"

// TestRuleCorpusUnicornPreferArrayIndexOf verifies unicorn/prefer-array-index-of
// reports the `findIndex((x) => x === literal)` shape.
//
// The rule matches `findIndex` callees whose single argument is a function with
// one parameter and a strict-equality body comparing that parameter against a
// literal. This fixture pins the concise-arrow shape with a numeric literal on
// the right — the most common positive case.
//
// 1. Enable unicorn/prefer-array-index-of via an expect annotation.
// 2. Call `xs.findIndex((x) => x === 2)` against a numeric literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies findIndex tests strict equality against a fixed value; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-array-index-of annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; indexOf searches the same fixed value directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferArrayIndexOf is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferArrayIndexOf(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-index-of.ts", "const xs = [1, 2, 3];\n// expect: unicorn/prefer-array-index-of error\nconst i = xs.findIndex((x) => x === 2);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-array-index-of", "const xs = [1,2,3]; const i = xs.indexOf(2);\n")
}
