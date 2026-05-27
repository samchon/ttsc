package linthost

import "testing"

// TestRuleCorpusNoRestrictedTypes verifies the lint rule corpus fixture typescript-no-restricted-types.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in typescript-no-restricted-types.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoRestrictedTypes(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-no-restricted-types.ts", "// expect: typescript/no-restricted-types error\nconst a: Object = {};\n\n// expect: typescript/no-restricted-types error\nconst b: Function = () => undefined;\n\n// expect: typescript/no-restricted-types error\nconst c: Number = 1 as never;\n\n// expect: typescript/no-restricted-types error\nconst d: String = \"\" as never;\n\n// expect: typescript/no-restricted-types error\nconst e: Boolean = true as never;\n\n// Lowercase primitives — never fire.\nconst ok1: number = 1;\nconst ok2: string = \"\";\nconst ok3: boolean = true;\nconst ok4: object = {};\n\nJSON.stringify({ a, b, c, d, e, ok1, ok2, ok3, ok4 });\n")
}
