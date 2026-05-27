package linthost

import "testing"

// TestRuleCorpusSortKeys verifies the lint rule corpus fixture sort-keys.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in sort-keys.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusSortKeys(t *testing.T) {
  assertRuleCorpusCase(t, "sort-keys.ts", "// Positive: `a` follows `b` and breaks ascending order; the rule\n// flags the offending key, not the preceding one.\nconst unsorted = {\n  b: 1,\n  // expect: sort-keys error\n  a: 2,\n};\nvoid unsorted;\n\n// Positive: string-literal keys participate in the same sort group as\n// identifier keys. `\"10\"` (digit byte) sorts before `alpha` (letter byte),\n// so the literal key reports.\nconst mixed = {\n  alpha: 1,\n  // expect: sort-keys error\n  \"10\": 2,\n};\nvoid mixed;\n\n// Negative: a spread divider resets the sort baseline, so keys after\n// the spread restart their own ordered group.\nconst withSpread = {\n  z: 1,\n  ...({ extra: 0 } as Record<string, number>),\n  a: 2,\n  b: 3,\n};\nvoid withSpread;\n\n// Negative: alphabetical keys do not fire.\nconst sorted = {\n  alpha: 1,\n  beta: 2,\n  gamma: 3,\n};\nvoid sorted;\n\n// Negative: a single-key object literal has nothing to compare.\nconst solo = { only: 1 };\nvoid solo;\n")
}
