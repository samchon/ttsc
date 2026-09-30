package linthost

import "testing"

// TestRuleCorpusObjectShorthand verifies the lint rule corpus fixture object-shorthand.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in object-shorthand.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original redundant x: x property with exact rule, severity and line while permitting already-short and differing-value properties.
// @evidence contracts/testing.md#independent-expectations Shorthand equivalence applies only when the key and referenced binding share the same name; authored diagnostic and clean controls encode that distinction.
// @evidence contracts/testing.md#distinguishing-cases The original x: x reports; { x }, { x: value } and an empty object remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusObjectShorthand owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusObjectShorthand(t *testing.T) {
  assertRuleCorpusCase(t, "object-shorthand.ts", "const x = 1;\n// expect: object-shorthand error\nconst o = { x: x };\nJSON.stringify(o);\n")
  assertRuleSkipsSource(t, "object-shorthand", "const x = 1; const value = 2; const short = { x }; const different = { x: value }; const empty = {};\n")
}
