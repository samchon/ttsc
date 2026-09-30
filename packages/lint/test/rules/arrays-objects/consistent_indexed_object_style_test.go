package linthost

import "testing"

// TestRuleCorpusConsistentIndexedObjectStyle verifies the lint rule corpus fixture consistent-indexed-object-style.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in consistent-indexed-object-style.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports a type literal consisting only of an index signature while permitting the equivalent Record spelling.
// @evidence contracts/testing.md#independent-expectations The default indexed-object style policy chooses Record; the authored type-alias annotation is the diagnostic oracle.
// @evidence contracts/testing.md#distinguishing-cases The single index-signature type reports; Record and an object type with an ordinary field stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusConsistentIndexedObjectStyle owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusConsistentIndexedObjectStyle(t *testing.T) {
  assertRuleCorpusCase(t, "consistent-indexed-object-style.ts", "// expect: typescript/consistent-indexed-object-style error\ntype Dict = { [key: string]: number };\nconst d: Dict = {};\nJSON.stringify(d);\n")
  assertRuleSkipsSource(t, "typescript/consistent-indexed-object-style", "type Dict = Record<string, number>; type Named = { value: number };\n")
}
