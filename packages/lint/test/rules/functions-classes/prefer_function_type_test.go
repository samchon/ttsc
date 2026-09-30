package linthost

import "testing"

// TestRuleCorpusPreferFunctionType verifies the lint rule corpus fixture prefer-function-type.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in prefer-function-type.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the call-only interface and permits an existing function type and a callable interface with an additional property.
// @evidence contracts/testing.md#independent-expectations A lone call signature can be represented as a function type; an independently authored property prevents that equivalence.
// @evidence contracts/testing.md#distinguishing-cases Call-only interface reports; function type and callable interface carrying label stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPreferFunctionType is selected in the shared Go unit population. It calls assertRuleCorpusCase with prefer-function-type.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusPreferFunctionType(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-function-type.ts", "// expect: typescript/prefer-function-type error\ninterface F {\n  (x: number): string;\n}\ndeclare const f: F;\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "typescript/prefer-function-type", "type F = (x: number) => string; interface Named { (x: number): string; label: string; }\n")
}
