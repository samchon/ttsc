package linthost

import "testing"

// TestRuleCorpusNoScriptUrl verifies the lint rule corpus fixture no-script-url.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-script-url.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original javascript-scheme string while permitting a normal HTTPS URL.
// @evidence contracts/testing.md#independent-expectations The script-URL prohibition supplies the literal scheme distinction and the authored diagnostic location independently.
// @evidence contracts/testing.md#distinguishing-cases javascript: reports; https://example.test remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoScriptUrl is selected in the shared Go unit population. It passes the authored no-script-url.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoScriptUrl(t *testing.T) {
  assertRuleCorpusCase(t, "no-script-url.ts", "// expect: no-script-url error\nconst u: string = \"javascript:alert(1)\";\nJSON.stringify(u);\n")
  assertRuleSkipsSource(t, "no-script-url", "const url = \"https://example.test\";\n")
}
