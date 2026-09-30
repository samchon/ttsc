package linthost

import "testing"

// TestRuleCorpusNoUnusedExpressionsSideEffectFreeKinds verifies the lint rule corpus fixture
// no-unused-expressions-side-effect-free-kinds.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case pins the upstream disallow-list one shape at a time: identifiers, member and element
// access, every literal form, templates, regexes, array/object/function/class expressions,
// ordinary binary operators, comma sequences, default-mode logical and ternary expressions,
// `typeof`, pure prefix unaries, tagged templates, `new.target`, and `this`.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares every original annotated default-unused-expression diagnostic while preserving the final void controls.
// @evidence contracts/testing.md#independent-expectations Literal annotations follow the supported default expression classification, not a runtime proof that getters or tag functions cannot cause effects; every expected location is independently authored.
// @evidence contracts/testing.md#distinguishing-cases Identifier/member/literal/template/container/function/class/operator/logical/ternary/unary/tag/meta/this forms retain all reports; void remains clean and AllowsProductiveKinds owns allowed operations.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnusedExpressionsSideEffectFreeKinds is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-unused-expressions-side-effect-free-kinds.ts through the AST Engine. No installed consumer, native artifact build or real product host runs.
func TestRuleCorpusNoUnusedExpressionsSideEffectFreeKinds(t *testing.T) {
  assertRuleCorpusCase(t, "no-unused-expressions-side-effect-free-kinds.ts", "declare const first: number;\ndeclare const second: number;\ndeclare const flag: boolean;\ndeclare const box: { value: number };\ndeclare const tag: (strings: TemplateStringsArray) => string;\n\n// expect: no-unused-expressions error\nfirst;\n// expect: no-unused-expressions error\nbox.value;\n// expect: no-unused-expressions error\nbox[\"value\"];\n// expect: no-unused-expressions error\n1;\n// expect: no-unused-expressions error\n123n;\n// expect: no-unused-expressions error\n\"not a directive here\";\n// expect: no-unused-expressions error\n`template ${first}`;\n// expect: no-unused-expressions error\n`no substitution`;\n// expect: no-unused-expressions error\n/pattern/;\n// expect: no-unused-expressions error\ntrue;\n// expect: no-unused-expressions error\nnull;\n// expect: no-unused-expressions error\n[first, second];\n// expect: no-unused-expressions error\n({ first, second });\n// expect: no-unused-expressions error\n(() => first);\n// expect: no-unused-expressions error\n(function named(): number {\n  return first;\n});\n// expect: no-unused-expressions error\n(class Ephemeral {});\n// expect: no-unused-expressions error\nfirst === second;\n// expect: no-unused-expressions error\nfirst + second;\n// expect: no-unused-expressions error\n(first, second);\n// expect: no-unused-expressions error\nflag && first;\n// expect: no-unused-expressions error\nflag ? first : second;\n// expect: no-unused-expressions error\ntypeof first;\n// expect: no-unused-expressions error\n-first;\n// expect: no-unused-expressions error\n!flag;\n// expect: no-unused-expressions error\ntag`value`;\n\nfunction meta(): void {\n  // expect: no-unused-expressions error\n  new.target;\n}\n\nclass Carrier {\n  describe(): void {\n    // expect: no-unused-expressions error\n    this;\n  }\n}\n\nvoid meta;\nvoid Carrier;\n")
}
