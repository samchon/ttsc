package linthost

import "testing"

// TestRuleCorpusNoMagicNumbers verifies the lint rule corpus fixture no-magic-numbers.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-magic-numbers.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoMagicNumbers(t *testing.T) {
  assertRuleCorpusCase(t, "no-magic-numbers.ts", "// Negative: ignored literals (0, 1, -1) never fire.\nconst zero = 0;\nconst one = 1;\nconst minusOne = -1;\n\n// Negative: `const x = N` is the named binding the rule wants.\nconst SECONDS_PER_MINUTE = 60;\n\n// Negative: enum member values are intentional named numbers.\nenum Status {\n  Pending = 0,\n  Done = 1,\n}\n\n// Negative: numeric subscript on element access is `ignoreArrayIndexes`.\nconst items = [zero, one];\nconst first = items[0];\n\n// Positive: a bare literal in an arithmetic expression carries no meaning.\n// expect: no-magic-numbers error\nconst total = SECONDS_PER_MINUTE * 60;\n\n// Positive: `let` cannot anchor a named constant — the value stays magic.\n// expect: no-magic-numbers error\nlet timeout = 5000;\n\nvoid minusOne;\nvoid Status;\nvoid first;\nvoid total;\nvoid timeout;\n")
}
