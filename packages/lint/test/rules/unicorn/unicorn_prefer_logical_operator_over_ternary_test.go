package linthost

import "testing"

// TestRuleCorpusUnicornPreferLogicalOperatorOverTernary verifies
// unicorn/prefer-logical-operator-over-ternary reports `x ? x : 0`.
//
// The fixture pins the `cond ? cond : alt` shape — the canonical positive
// case. The match is purely textual (the condition and `whenTrue`
// expressions must read identically after stripping parens), so a single
// declared identifier with a literal fallback exercises the core branch
// without dragging in a comparison or the negated alternative shape.
//
// 1. Enable unicorn/prefer-logical-operator-over-ternary via an expect annotation.
// 2. Declare `const y = x ? x : 0;`.
// 3. Assert the conditional expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a ternary repeats its condition as the truthy result; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-logical-operator-over-ternary annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; logical OR retains the truthy value and the fallback. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferLogicalOperatorOverTernary is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferLogicalOperatorOverTernary(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-logical-operator-over-ternary.ts", "declare const x: number | undefined;\n// expect: unicorn/prefer-logical-operator-over-ternary error\nconst y = x ? x : 0;\nvoid y;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-logical-operator-over-ternary", "declare const x: number | undefined; const y = x || 0;\n")
}
