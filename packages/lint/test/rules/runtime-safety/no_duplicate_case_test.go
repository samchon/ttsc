package linthost

import "testing"

// TestRuleCorpusNoDuplicateCase verifies the lint rule corpus fixture no-duplicate-case.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-duplicate-case.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original second case 1 while permitting distinct case labels.
// @evidence contracts/testing.md#independent-expectations Equal authored literal labels select the same switch arm, establishing the duplicate independently of AST findings.
// @evidence contracts/testing.md#distinguishing-cases Repeated label 1 reports; labels 1 and 2 remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDuplicateCase is selected in the shared Go unit population. It passes the authored no-duplicate-case.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoDuplicateCase(t *testing.T) {
  assertRuleCorpusCase(t, "no-duplicate-case.ts", "function f(x: number) {\n  switch (x) {\n    case 1:\n      return \"a\";\n    // expect: no-duplicate-case error\n    case 1:\n      return \"b\";\n  }\n  return \"\";\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-duplicate-case", "switch (value) { case 1: break; case 2: break; }\n")
}
