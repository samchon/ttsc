package linthost

import "testing"

// TestRuleCorpusNoSparseArrays verifies the lint rule corpus fixture no-sparse-arrays.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-sparse-arrays.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine rejects the omitted element in the original three-slot array while permitting empty, singleton and explicit undefined elements.
// @evidence contracts/testing.md#independent-expectations An omitted array slot is distinct from a present undefined value; the independent annotation identifies sparse syntax rather than runtime contents.
// @evidence contracts/testing.md#distinguishing-cases The middle hole reports; [], [1] and [1, undefined, 3] remain clean size and explicit-value controls.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoSparseArrays owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusNoSparseArrays(t *testing.T) {
  assertRuleCorpusCase(t, "no-sparse-arrays.ts", "// expect: no-sparse-arrays error\nconst a = [1, , 3];\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "no-sparse-arrays", "const empty = []; const singleton = [1]; const dense = [1, undefined, 3];\n")
}
