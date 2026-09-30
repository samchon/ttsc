package linthost

import "testing"

// TestRuleCorpusNoObjectConstructor verifies the lint rule corpus fixture no-object-constructor.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-object-constructor.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports empty Object construction while permitting object literals and one-argument wrapper calls.
// @evidence contracts/testing.md#independent-expectations The object-literal policy targets empty construction rather than Object(value) wrapping semantics, providing an independent permitted boundary.
// @evidence contracts/testing.md#distinguishing-cases new Object() reports; an empty literal and Object(1) remain clean controls.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoObjectConstructor owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusNoObjectConstructor(t *testing.T) {
  assertRuleCorpusCase(t, "no-object-constructor.ts", "// expect: no-object-constructor error\nconst o = new Object();\nJSON.stringify(o);\n")
  assertRuleSkipsSource(t, "no-object-constructor", "const literal = {}; const wrapper = Object(1);\n")
}
