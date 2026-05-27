package linthost

import "testing"

// TestRuleCorpusSortImports verifies the lint rule corpus fixture sort-imports.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in sort-imports.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusSortImports(t *testing.T) {
  assertRuleCorpusCase(t, "sort-imports.ts", "// Positive: named specifiers are out of order; the first offending name\n// (`a`, sorted after `b`) is flagged.\n// expect: sort-imports error\nimport { b, a } from \"first\";\nvoid a;\nvoid b;\n\n// Positive: alias targets are the sort key. `a as z` reads as `z`, so\n// the following `b` is out of order relative to it.\n// expect: sort-imports error\nimport { a as z, b } from \"second\";\nvoid z;\nvoid b;\n\n// Negative: alphabetical named specifiers across multiple lines are fine.\nimport { alpha, beta, gamma } from \"third\";\nvoid alpha;\nvoid beta;\nvoid gamma;\n\n// Negative: single-specifier and default-only imports have nothing to sort.\nimport single from \"fourth\";\nimport only from \"fifth\";\nvoid single;\nvoid only;\n")
}
