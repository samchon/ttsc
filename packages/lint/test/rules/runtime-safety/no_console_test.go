package linthost

import "testing"

// TestRuleCorpusNoConsole verifies the lint rule corpus fixture no-console.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-console.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports console.log while permitting an unrelated receiver with the same method name.
// @evidence contracts/testing.md#independent-expectations The default console-call policy concerns the console receiver; the authored annotation is not derived from method-name matches.
// @evidence contracts/testing.md#distinguishing-cases console.log reports; logger.log and a non-call console reference stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoConsole is selected in the shared Go unit population. It passes the authored no-console.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoConsole(t *testing.T) {
  assertRuleCorpusCase(t, "no-console.ts", "// expect: no-console error\nconsole.log(\"hi\");\n")
  assertRuleSkipsSource(t, "no-console", "logger.log(\"hi\"); const retained = console;\n")
}
