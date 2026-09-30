package linthost

import "testing"

// TestRuleCorpusNoWith verifies the lint rule corpus fixture no-with.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-with.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original with statement and permits ordinary object-member access.
// @evidence contracts/testing.md#independent-expectations The dynamic-scope with prohibition independently distinguishes special statement syntax from explicit receiver access.
// @evidence contracts/testing.md#distinguishing-cases Original with(o) reports; log(o.value) stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoWith is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-with.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoWith(t *testing.T) {
  assertRuleCorpusCase(t, "no-with.ts", "function f(o: any) {\n  // expect: no-with error\n  with (o) {\n    console.log(\"hi\");\n  }\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-with", "function f(o: any) { log(o.value); }\n")
}
