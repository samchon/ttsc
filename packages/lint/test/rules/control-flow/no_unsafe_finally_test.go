package linthost

import "testing"

// TestRuleCorpusNoUnsafeFinally verifies the lint rule corpus fixture no-unsafe-finally.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-unsafe-finally.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original finally return overriding a throw and permits finally cleanup without abrupt completion.
// @evidence contracts/testing.md#independent-expectations A return from finally replaces the pending completion; independently authored cleanup alone preserves it.
// @evidence contracts/testing.md#distinguishing-cases Original overriding return reports; log(cleanup) in finally stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeFinally is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-unsafe-finally.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoUnsafeFinally(t *testing.T) {
  assertRuleCorpusCase(t, "no-unsafe-finally.ts", "function f() {\n  try {\n    throw new Error(\"x\");\n  } finally {\n    // expect: no-unsafe-finally error\n    return 1;\n  }\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-unsafe-finally", "function f() { try { throw new Error(\"x\"); } finally { log(\"cleanup\"); } }\n")
}
