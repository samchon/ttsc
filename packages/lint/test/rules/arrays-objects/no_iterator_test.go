package linthost

import "testing"

// TestRuleCorpusNoIterator verifies the lint rule corpus fixture no-iterator.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-iterator.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine rejects legacy __iterator__ access without rejecting the modern Symbol.iterator protocol access.
// @evidence contracts/testing.md#independent-expectations The reserved legacy extension differs from the standard iterable symbol; the original authored annotation supplies the legacy diagnostic location.
// @evidence contracts/testing.md#distinguishing-cases The legacy dot property reports; Symbol.iterator and an ordinary iterator-named property remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoIterator owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusNoIterator(t *testing.T) {
  assertRuleCorpusCase(t, "no-iterator.ts", "const o: any = {};\n// expect: no-iterator error\nJSON.stringify(o.__iterator__);\n")
  assertRuleSkipsSource(t, "no-iterator", "obj[Symbol.iterator]; obj.iterator;\n")
}
