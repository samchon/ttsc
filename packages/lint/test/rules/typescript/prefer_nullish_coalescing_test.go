package linthost

import "testing"

// TestRuleCorpusPreferNullishCoalescing verifies the lint rule corpus fixture typescript-prefer-nullish-coalescing.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in typescript-prefer-nullish-coalescing.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusPreferNullishCoalescing(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-prefer-nullish-coalescing.ts", "declare const maybe: string | undefined;\ndeclare const other: string;\n\n// expect: typescript/prefer-nullish-coalescing error\nconst a = maybe || other;\n\nlet b: string | undefined = maybe;\n// expect: typescript/prefer-nullish-coalescing error\nb ||= other;\n\n// expect: typescript/prefer-nullish-coalescing error\nconst c = maybe ? maybe : other;\n\n// Boolean context — `||` is fine here because the surrounding `if`\n// already coerces to boolean, so the falsy-vs-nullish distinction does\n// not matter.\nif (maybe || other) {\n  JSON.stringify(maybe);\n}\nwhile (maybe || other) {\n  break;\n}\nconst d = !(maybe || other);\nconst e = maybe || other ? \"t\" : \"f\";\n\n// Already using `??` — never fires.\nconst f = maybe ?? other;\nlet g: string | undefined = maybe;\ng ??= other;\n\nJSON.stringify({ a, b, c, d, e, f, g });\n")
}
