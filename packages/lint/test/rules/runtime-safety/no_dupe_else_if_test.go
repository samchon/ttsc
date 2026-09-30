package linthost

import "testing"

// TestRuleCorpusNoDupeElseIf verifies the lint rule corpus fixture no-dupe-else-if.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-dupe-else-if.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the repeated later a branch while leaving the earlier independent b branch clean.
// @evidence contracts/testing.md#independent-expectations The authored later-a annotation follows coverage by the preceding a branch, not a count generated from current findings.
// @evidence contracts/testing.md#distinguishing-cases Repeated a is covered despite an intervening b; the logical-coverage table owns accumulated alternatives, conjunctions and conservative token boundaries.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDupeElseIf is selected in the shared Go unit population. It passes the authored no-dupe-else-if.ts fixture through assertRuleCorpusCase to the owning AST Engine. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoDupeElseIf(t *testing.T) {
  assertRuleCorpusCase(t, "no-dupe-else-if.ts", "function f(a: any, b: any) {\n  if (a) {\n    return 1;\n  } else if (b) {\n    return 2;\n  }\n  // expect: no-dupe-else-if error\n  else if (a) {\n    return 3;\n  }\n  return 0;\n}\nJSON.stringify(f);\n")
}
