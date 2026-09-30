package linthost

import "testing"

// TestRuleCorpusNoArrayConstructor verifies the lint rule corpus fixture no-array-constructor.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-array-constructor.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original empty untyped Array construction while allowing literal, length and explicitly typed construction forms.
// @evidence contracts/testing.md#independent-expectations The array-literal policy forbids unnecessary untyped construction but retains the one-argument length ambiguity and explicit generic form.
// @evidence contracts/testing.md#distinguishing-cases Empty untyped construction reports; an empty literal, Array(3) and new Array<string>() remain clean adjacent boundaries.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoArrayConstructor owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusNoArrayConstructor(t *testing.T) {
  assertRuleCorpusCase(t, "no-array-constructor.ts", "// expect: no-array-constructor error\nconst a = new Array();\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "no-array-constructor", "const empty = []; const length = Array(3); const typed = new Array<string>();\n")
}
