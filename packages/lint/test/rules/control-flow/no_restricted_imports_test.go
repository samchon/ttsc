package linthost

import "testing"

// TestRuleCorpusNoRestrictedImports verifies the lint rule corpus fixture no-restricted-imports.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-restricted-imports.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoRestrictedImports(t *testing.T) {
  assertRuleCorpusCase(t, "no-restricted-imports.ts", "// Positive: hard-coded deny list flags `lodash` at the specifier.\n// expect: no-restricted-imports error\nimport _ from \"lodash\";\n\n// Positive: a `from` re-export hits the same deny list.\n// expect: no-restricted-imports error\nexport { isArray } from \"underscore\";\n\n// Negative: any specifier outside the deny list passes through.\nimport * as fs from \"node:fs\";\n\nvoid _;\nvoid fs;\n")
}
