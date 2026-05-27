package linthost

import "testing"

// TestRuleCorpusPreferOptionalChain verifies the lint rule corpus fixture typescript-prefer-optional-chain.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in typescript-prefer-optional-chain.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusPreferOptionalChain(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-prefer-optional-chain.ts", "declare const obj: { foo?: { bar?: number; baz?(): number } } | null;\n\n// expect: typescript/prefer-optional-chain error\nconst a = obj && obj.foo;\n\n// expect: typescript/prefer-optional-chain error\nconst b = obj && obj.foo && obj.foo.bar;\n\n// expect: typescript/prefer-optional-chain error\nconst c = obj != null && obj.foo;\n\n// expect: typescript/prefer-optional-chain error\nconst d = obj !== null && obj.foo;\n\n// expect: typescript/prefer-optional-chain error\nconst e = obj !== undefined && obj.foo;\n\n// expect: typescript/prefer-optional-chain error\nconst f = obj && obj.foo && obj.foo.baz();\n\n// Different chain — left side does not prefix the right side; safe.\ndeclare const other: { bar?: number } | null;\nconst valid1 = obj && other!.bar;\n\n// Call with arguments — `?.()` would change argument evaluation; safe.\ndeclare const callable: { run?(x: number): number } | null;\nconst valid2 = callable && callable.run!(1);\n\nJSON.stringify([a, b, c, d, e, f, valid1, valid2]);\n")
}
