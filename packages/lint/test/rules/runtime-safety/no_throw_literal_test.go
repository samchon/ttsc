package linthost

import "testing"

// TestRuleCorpusNoThrowLiteral verifies the lint rule corpus fixture no-throw-literal.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-throw-literal.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original thrown string while permitting construction of an Error object.
// @evidence contracts/testing.md#independent-expectations The literal-throw policy requires a potential error object; the authored string annotation is independent of emitted findings.
// @evidence contracts/testing.md#distinguishing-cases A string literal throws report; throw new Error with the same message remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoThrowLiteral is selected in the shared Go unit population. It passes the authored no-throw-literal.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoThrowLiteral(t *testing.T) {
  assertRuleCorpusCase(t, "no-throw-literal.ts", "function f() {\n  // expect: no-throw-literal error\n  throw \"literal\";\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-throw-literal", "function f() { throw new Error(\"literal\"); }\n")
}
