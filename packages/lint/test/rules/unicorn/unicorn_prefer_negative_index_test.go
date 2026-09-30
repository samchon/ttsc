package linthost

import "testing"

// TestRuleCorpusUnicornPreferNegativeIndex verifies
// unicorn/prefer-negative-index reports `a.slice(a.length - 1)`.
//
// The fixture pins the canonical `.slice` shape — the most common host of
// the `arr.length - N` argument — because the four other method names
// (`splice`, `toSpliced`, `at`, `lastIndexOf`) flow through the same
// argument-shape check. The diagnostic anchors to the binary expression
// inside the call, not the call itself, so a small literal array keeps
// the expect-annotation target on the right line.
//
// 1. Enable unicorn/prefer-negative-index via an expect annotation.
// 2. Declare `const tail = a.slice(a.length - 1);`.
// 3. Assert the binary index expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies slice computes a negative offset from the receiver length; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-negative-index annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; slice spells that same tail offset as -1. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferNegativeIndex is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferNegativeIndex(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-negative-index.ts", "const a = [1, 2, 3];\n// expect: unicorn/prefer-negative-index error\nconst tail = a.slice(a.length - 1);\nvoid tail;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-negative-index", "const a = [1,2,3]; const tail = a.slice(-1);\n")
}
