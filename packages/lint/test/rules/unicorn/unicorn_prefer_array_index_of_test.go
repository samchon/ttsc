package linthost

import "testing"

// TestRuleCorpusUnicornPreferArrayIndexOf verifies unicorn/prefer-array-index-of
// reports the `findIndex((x) => x === literal)` shape.
//
// The rule matches `findIndex` callees whose single argument is a function with
// one parameter and a strict-equality body comparing that parameter against a
// literal. This fixture pins the concise-arrow shape with a numeric literal on
// the right — the most common positive case.
//
// 1. Enable unicorn/prefer-array-index-of via an expect annotation.
// 2. Call `xs.findIndex((x) => x === 2)` against a numeric literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferArrayIndexOf(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-index-of.ts", "const xs = [1, 2, 3];\n// expect: unicorn/prefer-array-index-of error\nconst i = xs.findIndex((x) => x === 2);\n")
}
