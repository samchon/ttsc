package linthost

import "testing"

// TestRuleCorpusNoEqNull verifies the lint rule corpus fixture no-eq-null.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-eq-null.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports loose equality against null while permitting a strict null comparison.
// @evidence contracts/testing.md#independent-expectations Loose equality collapses null and undefined; the explicit-null policy supplies the authored diagnostic independently.
// @evidence contracts/testing.md#distinguishing-cases x == null reports; x === null and x !== null stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoEqNull is selected in the shared Go unit population. It passes the authored no-eq-null.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoEqNull(t *testing.T) {
  assertRuleCorpusCase(t, "no-eq-null.ts", "function f(x: any) {\n  // expect: no-eq-null error\n  return x == null;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-eq-null", "function f(x: any) { return [x === null, x !== null]; }\n")
}
