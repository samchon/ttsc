package linthost

import "testing"

// TestRuleCorpusNoEval verifies the lint rule corpus fixture no-eval.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-eval.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original eval call without rejecting a different function name.
// @evidence contracts/testing.md#independent-expectations The eval-call prohibition supplies the authored location; no repository text or call result is used as its oracle.
// @evidence contracts/testing.md#distinguishing-cases eval reports; evaluate with the same argument stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoEval is selected in the shared Go unit population. It passes the authored no-eval.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoEval(t *testing.T) {
  assertRuleCorpusCase(t, "no-eval.ts", "// expect: no-eval error\neval(\"1\");\n")
  assertRuleSkipsSource(t, "no-eval", "evaluate(\"1\");\n")
}
