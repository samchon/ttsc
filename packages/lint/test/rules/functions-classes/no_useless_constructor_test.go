package linthost

import "testing"

// TestRuleCorpusNoUselessConstructor verifies the lint rule corpus fixture no-useless-constructor.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-useless-constructor.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the empty constructor and permits a constructor performing initialization.
// @evidence contracts/testing.md#independent-expectations An explicitly empty constructor adds no body behavior; assigning a field independently makes constructor work necessary.
// @evidence contracts/testing.md#distinguishing-cases Original empty constructor reports; constructor assigning value stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUselessConstructor is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-useless-constructor.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoUselessConstructor(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-constructor.ts", "class Empty {\n  // expect: no-useless-constructor error\n  constructor() {}\n}\n")
  assertRuleSkipsSource(t, "no-useless-constructor", "class Filled { value: number; constructor() { this.value = 1; } }\n")
}
