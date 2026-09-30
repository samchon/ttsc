package linthost

import "testing"

// TestRuleCorpusNoMisusedNew verifies the lint rule corpus fixture no-misused-new.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-misused-new.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports an interface constructor member and permits a genuine construct signature.
// @evidence contracts/testing.md#independent-expectations An interface describes construction with new rather than a constructor method; authored syntax supplies that independent distinction.
// @evidence contracts/testing.md#distinguishing-cases The constructor method reports; new(): I stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoMisusedNew is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-misused-new.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoMisusedNew(t *testing.T) {
  assertRuleCorpusCase(t, "no-misused-new.ts", "interface I {\n  // expect: typescript/no-misused-new error\n  constructor(): void;\n}\ndeclare const i: I;\nJSON.stringify(i);\n")
  assertRuleSkipsSource(t, "typescript/no-misused-new", "interface I { new(): I; }\n")
}
