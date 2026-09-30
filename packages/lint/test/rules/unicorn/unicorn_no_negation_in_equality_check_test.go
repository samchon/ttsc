package linthost

import "testing"

// TestRuleCorpusUnicornNoNegationInEqualityCheck verifies
// unicorn/no-negation-in-equality-check reports `!a === b`, whose
// associativity (`(!a) === b`) almost never matches the author's
// intent.
//
// The rule visits each `BinaryExpression`, matches on the four
// equality operator tokens, and checks whether the left operand
// (after stripping parens) is a `!` prefix-unary expression. The
// fixture uses `declare const` so the operands carry types without
// adding noise.
//
// 1. Enable unicorn/no-negation-in-equality-check via an expect annotation.
// 2. Write `const eq = !a === b;` on declared variables.
// 3. Assert the equality binary expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies logical negation is compared with strict equality; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-negation-in-equality-check annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; strict inequality expresses the comparison without operand negation. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoNegationInEqualityCheck is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoNegationInEqualityCheck(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-negation-in-equality-check.ts", "declare const a: number;\ndeclare const b: number;\n// expect: unicorn/no-negation-in-equality-check error\nconst eq = !a === b;\nvoid eq;\n")
  assertRuleSkipsSource(t, "unicorn/no-negation-in-equality-check", "declare const a: number; declare const b: number; const eq = a !== b;\n")
}
