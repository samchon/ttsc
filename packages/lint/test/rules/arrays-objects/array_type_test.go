package linthost

import "testing"

// TestRuleCorpusArrayType verifies the lint rule corpus fixture array-type.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in array-type.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original Array<string> annotation with exact rule, severity and line while permitting bracket array syntax.
// @evidence contracts/testing.md#independent-expectations The default array-style policy favors T[]; the independently authored annotation names the generic Array form, not generated rule output.
// @evidence contracts/testing.md#distinguishing-cases Array<string> reports; mutable and readonly bracket syntax stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusArrayType owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusArrayType(t *testing.T) {
  assertRuleCorpusCase(t, "array-type.ts", "// expect: typescript/array-type error\nconst a: Array<string> = [];\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "typescript/array-type", "const a: string[] = []; const b: readonly string[] = [];\n")
}
