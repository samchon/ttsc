package linthost

import "testing"

// TestRuleCorpusDotNotation verifies the lint rule corpus fixture dot-notation.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in dot-notation.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares the complete normalized finding set for the safe name key while leaving the hyphenated key clean in the same original fixture.
// @evidence contracts/testing.md#independent-expectations The authored line annotation selects only the dot-spellable name access; JavaScript property-name grammar establishes the preserved bracket control.
// @evidence contracts/testing.md#distinguishing-cases name reports while not-valid-key stays clean; separate fixer and suggestion cases own edit policy rather than duplicating this detection oracle.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusDotNotation owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusDotNotation(t *testing.T) {
  assertRuleCorpusCase(t, "dot-notation.ts", "const box = { name: \"ttsc\", \"not-valid-key\": \"kept\" };\n\n// expect: dot-notation error\nconst value = box[\"name\"];\nconst kept = box[\"not-valid-key\"];\n\nJSON.stringify([value, kept]);\n")
}
