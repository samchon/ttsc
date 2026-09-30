package linthost

import "testing"

// TestRuleCorpusNoAlert verifies the lint rule corpus fixture no-alert.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-alert.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original alert call and permits a differently named notification function.
// @evidence contracts/testing.md#independent-expectations The modal-browser-API policy selects alert, not all function calls; the authored line annotation supplies the independent diagnostic location.
// @evidence contracts/testing.md#distinguishing-cases alert reports; notify and a non-call alert reference stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoAlert is selected in the shared Go unit population. It passes the authored no-alert.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoAlert(t *testing.T) {
  assertRuleCorpusCase(t, "no-alert.ts", "declare function alert(msg: string): void;\n// expect: no-alert error\nalert(\"hi\");\n")
  assertRuleSkipsSource(t, "no-alert", "notify(\"hi\"); const handler = alert;\n")
}
