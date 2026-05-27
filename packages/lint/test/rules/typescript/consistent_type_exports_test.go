package linthost

import "testing"

// TestRuleCorpusConsistentTypeExports verifies the lint rule corpus fixture typescript-consistent-type-exports.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in typescript-consistent-type-exports.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusConsistentTypeExports(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-consistent-type-exports.ts", "interface OnlyType {\n  value: number;\n}\n\ntype OnlyAlias = { kind: \"alias\" };\n\ninterface MixedType {\n  ok: true;\n}\n\nconst mixedValue = { ok: true };\n\n// expect: typescript/consistent-type-exports error\nexport { OnlyType };\n\n// expect: typescript/consistent-type-exports error\nexport { OnlyType, OnlyAlias };\n\n// At least one exported name (`mixedValue`) is a value declaration in\n// this file, so the rewrite would be wrong. Should NOT fire.\nexport { MixedType, mixedValue };\n\n// Already `export type { ... }` — never fires.\nexport type { OnlyType as AliasA };\n\n// Empty re-export marker — no specifiers to classify.\nexport {};\n")
}
