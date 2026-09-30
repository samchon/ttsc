package linthost

import "testing"

// TestRuleCorpusNoEmptyFunction verifies the lint rule corpus fixture no-empty-function.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-empty-function.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports an empty function while permitting a nonempty body and a deliberately commented empty body.
// @evidence contracts/testing.md#independent-expectations The rule excludes bodies carrying intentional comments; a call statement independently makes a body nonempty.
// @evidence contracts/testing.md#distinguishing-cases Empty uncommented function reports; work call and documented empty function stay clean. The option tests own category exemptions.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoEmptyFunction is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-empty-function.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoEmptyFunction(t *testing.T) {
  assertRuleCorpusCase(t, "no-empty-function.ts", "// expect: no-empty-function error\nfunction f(): void {}\nf();\n")
  assertRuleSkipsSource(t, "no-empty-function", "function active() { work(); } function intentional() { /* intentionally empty */ }\n")
}
