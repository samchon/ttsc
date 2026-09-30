package linthost

import "testing"

// TestRuleCorpusNoNewWrappers verifies the lint rule corpus fixture no-new-wrappers.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-new-wrappers.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original new String wrapper while permitting normal primitive conversion calls.
// @evidence contracts/testing.md#independent-expectations The primitive-wrapper policy distinguishes boxed construction from String/Number/Boolean conversion; the original annotation is independently authored.
// @evidence contracts/testing.md#distinguishing-cases new String reports; String, Number and Boolean calls remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoNewWrappers is selected in the shared Go unit population. It passes the authored no-new-wrappers.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoNewWrappers(t *testing.T) {
  assertRuleCorpusCase(t, "no-new-wrappers.ts", "// expect: no-new-wrappers error\nconst s = new String(\"a\");\nJSON.stringify(s);\n")
  assertRuleSkipsSource(t, "no-new-wrappers", "const text = String(\"a\"); const number = Number(\"1\"); const boolean = Boolean(1);\n")
}
