package linthost

import "testing"

// TestRuleCorpusBanTsComment verifies the lint rule corpus fixture ban-ts-comment.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in ban-ts-comment.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic. The fixture pins the upstream recommended
// defaults: `@ts-nocheck` before code and `@ts-ignore` report, while a described
// `@ts-expect-error` and a prose mention of a directive stay silent.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusBanTsComment(t *testing.T) {
  assertRuleCorpusCase(t, "ban-ts-comment.ts", "// expect: typescript/ban-ts-comment error\n// @ts-nocheck\n// expect: typescript/ban-ts-comment error\n// @ts-ignore\nconst a: number = \"oops\" as any;\n\n// @ts-expect-error: described suppressions stay allowed by default\nconst b: number = \"oops\";\n\n// just a comment mentioning @ts-ignore stays a negative control\nJSON.stringify([a, b]);\n")
}
