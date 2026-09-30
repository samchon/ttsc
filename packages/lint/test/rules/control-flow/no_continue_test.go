package linthost

import "testing"

// TestRuleCorpusNoContinue verifies the lint rule corpus fixture no-continue.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-continue.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original loop continue and permits an otherwise ordinary loop body.
// @evidence contracts/testing.md#independent-expectations The configured continue prohibition targets the continue statement, not all loops or conditional bodies.
// @evidence contracts/testing.md#distinguishing-cases Original conditional continue reports; a loop containing only log(i) stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoContinue is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-continue.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoContinue(t *testing.T) {
  assertRuleCorpusCase(t, "no-continue.ts", "for (let i = 0; i < 3; i++) {\n  // expect: no-continue error\n  if (i === 1) continue;\n  console.log(i);\n}\n")
  assertRuleSkipsSource(t, "no-continue", "for (let i = 0; i < 3; i++) { log(i); }\n")
}
