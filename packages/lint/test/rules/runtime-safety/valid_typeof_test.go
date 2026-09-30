package linthost

import "testing"

// TestRuleCorpusValidTypeof verifies the lint rule corpus fixture valid-typeof.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in valid-typeof.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares the typo diagnostic while preserving known string and relational string-comparison controls in the same original source.
// @evidence contracts/testing.md#independent-expectations The supported typeof result vocabulary includes string but not stirng; relational comparisons order strings rather than specify type names.
// @evidence contracts/testing.md#distinguishing-cases The equality typo reports; known string, less-than and greater-or-equal controls remain clean. The scope table owns all equality operators and shared-rule ordering behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusValidTypeof is selected in the shared Go unit population. It passes the authored valid-typeof.ts fixture through assertRuleCorpusCase to the owning AST Engine. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusValidTypeof(t *testing.T) {
  assertRuleCorpusCase(t, "valid-typeof.ts", "function f(x: any) {\n  // expect: valid-typeof error\n  const typo = typeof x === \"stirng\";\n  const known = typeof x === \"string\";\n  const ordered = typeof x < \"m\";\n  const orderedOrEqual = typeof x >= \"z\";\n  return [typo, known, ordered, orderedOrEqual];\n}\nJSON.stringify(f);\n")
}
