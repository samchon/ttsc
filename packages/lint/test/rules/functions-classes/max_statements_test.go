package linthost

import "testing"

// TestRuleCorpusMaxStatements verifies the lint rule corpus fixture max-statements.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in max-statements.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original eleven-statement body while preserving the exactly-ten statement control.
// @evidence contracts/testing.md#independent-expectations The default maximum is ten top-level statements; the fixed declarations and return independently establish eleven versus ten.
// @evidence contracts/testing.md#distinguishing-cases One statement beyond the limit reports; the neighboring exact limit does not.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusMaxStatements is selected in the shared Go unit population. It calls assertRuleCorpusCase with max-statements.ts through the owning Engine. No consumer install, native artifact build or real host runs.
func TestRuleCorpusMaxStatements(t *testing.T) {
  assertRuleCorpusCase(t, "max-statements.ts", "// Positive: eleven top-level statements in the function body exceed the\n// default ceiling of ten.\n// expect: max-statements error\nfunction eleven(): number {\n  const a = 1;\n  const b = 2;\n  const c = 3;\n  const d = 4;\n  const e = 5;\n  const f = 6;\n  const g = 7;\n  const h = 8;\n  const i = 9;\n  const j = 10;\n  return a + b + c + d + e + f + g + h + i + j;\n}\n\n// Negative: exactly ten statements sits at the limit, not over it.\nfunction ten(): number {\n  const a = 1;\n  const b = 2;\n  const c = 3;\n  const d = 4;\n  const e = 5;\n  const f = 6;\n  const g = 7;\n  const h = 8;\n  const i = 9;\n  return a + b + c + d + e + f + g + h + i;\n}\n\nJSON.stringify({\n  eleven: eleven(),\n  ten: ten(),\n});\n")
}
