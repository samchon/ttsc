package linthost

import "testing"

// TestRuleCorpusNoConstantCondition verifies the lint rule corpus fixture no-constant-condition.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-constant-condition.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the literal-one if condition while permitting a condition read from an identifier.
// @evidence contracts/testing.md#independent-expectations A literal-one predicate is constant independently of runtime input; the authored annotation marks that condition under the default rule policy.
// @evidence contracts/testing.md#distinguishing-cases The numeric literal reports; an identifier-valued condition remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoConstantCondition is selected in the shared Go unit population. It passes the authored no-constant-condition.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoConstantCondition(t *testing.T) {
  assertRuleCorpusCase(t, "no-constant-condition.ts", "// expect: no-constant-condition error\nif (1) {\n  console.log(\"always\");\n}\n")
  assertRuleSkipsSource(t, "no-constant-condition", "if (enabled) { work(); }\n")
}
