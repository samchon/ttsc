package linthost

import "testing"

// TestRuleCorpusUnicornPreferAt verifies unicorn/prefer-at reports the
// `arr[arr.length - N]` shape.
//
// The rule walks the element-access expression and requires the index to be a
// `length - positive-integer` subtraction. This fixture pins the most common
// arm — the last-element pattern with N=1 — so regressions in the positive-int
// validator surface here before exotic literal forms are tested.
//
// 1. Enable unicorn/prefer-at via an expect annotation.
// 2. Index `xs[xs.length - 1]`.
// 3. Assert the element access is reported.
func TestRuleCorpusUnicornPreferAt(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-at.ts", "const xs = [1, 2, 3];\n// expect: unicorn/prefer-at error\nconst last = xs[xs.length - 1];\n")
}
