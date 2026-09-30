package linthost

import "testing"

// TestRuleCorpusPreferExponentiationOperator verifies the lint rule corpus fixture prefer-exponentiation-operator.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in prefer-exponentiation-operator.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports Math.pow(2,3) while permitting the exponentiation operator.
// @evidence contracts/testing.md#independent-expectations The supported modern spelling uses **; independently authored old-call marker and modern-expression zero expectation determine the policy contrast.
// @evidence contracts/testing.md#distinguishing-cases Call-form positive and ** negative distinguish spelling preference from arithmetic value.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource owns the authored modern-syntax control. Both assertions execute under this discoverable Test entry. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusPreferExponentiationOperator(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-exponentiation-operator.ts", "// expect: prefer-exponentiation-operator error\nconst a = Math.pow(2, 3);\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "prefer-exponentiation-operator", "const value = 2 ** 3;\n")
}
