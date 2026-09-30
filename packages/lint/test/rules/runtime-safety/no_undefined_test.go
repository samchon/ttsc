package linthost

import "testing"

// TestRuleCorpusNoUndefined verifies the lint rule corpus fixture no-undefined.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-undefined.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original undefined identifier while permitting void 0 for the same undefined value.
// @evidence contracts/testing.md#independent-expectations This rule prohibits the identifier spelling rather than the runtime value; the authored annotation and alternate expression establish independent distinctions.
// @evidence contracts/testing.md#distinguishing-cases undefined reports; void 0 remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUndefined is selected in the shared Go unit population. It passes the authored no-undefined.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoUndefined(t *testing.T) {
  assertRuleCorpusCase(t, "no-undefined.ts", "// expect: no-undefined error\nconst x = undefined;\nJSON.stringify(x);\n")
  assertRuleSkipsSource(t, "no-undefined", "const value = void 0;\n")
}
