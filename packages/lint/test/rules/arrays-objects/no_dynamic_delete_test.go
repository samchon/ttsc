package linthost

import "testing"

// TestRuleCorpusNoDynamicDelete verifies the lint rule corpus fixture no-dynamic-delete.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-dynamic-delete.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original identifier-computed delete key while retaining the static string deletion as a clean in-fixture control.
// @evidence contracts/testing.md#independent-expectations The dynamic-delete policy permits literal keys but rejects a value computed from a variable; the authored annotation identifies the key-dependent operation.
// @evidence contracts/testing.md#distinguishing-cases box[key] reports while box["name"] stays clean; literal numeric and dot-access deletes are additional static controls.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDynamicDelete owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusNoDynamicDelete(t *testing.T) {
  assertRuleCorpusCase(t, "no-dynamic-delete.ts", "const key = \"name\";\nconst box: Record<string, string> = { name: \"ttsc\" };\n\n// expect: typescript/no-dynamic-delete error\ndelete box[key];\ndelete box[\"name\"];\n")
  assertRuleSkipsSource(t, "typescript/no-dynamic-delete", "delete box[0]; delete box.name;\n")
}
