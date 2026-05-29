package linthost

import "testing"

// TestRuleCorpusUnicornPreferNegativeIndex verifies
// unicorn/prefer-negative-index reports `a.slice(a.length - 1)`.
//
// The fixture pins the canonical `.slice` shape — the most common host of
// the `arr.length - N` argument — because the four other method names
// (`splice`, `toSpliced`, `at`, `lastIndexOf`) flow through the same
// argument-shape check. The diagnostic anchors to the binary expression
// inside the call, not the call itself, so a small literal array keeps
// the expect-annotation target on the right line.
//
// 1. Enable unicorn/prefer-negative-index via an expect annotation.
// 2. Declare `const tail = a.slice(a.length - 1);`.
// 3. Assert the binary index expression is reported.
func TestRuleCorpusUnicornPreferNegativeIndex(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-negative-index.ts", "const a = [1, 2, 3];\n// expect: unicorn/prefer-negative-index error\nconst tail = a.slice(a.length - 1);\nvoid tail;\n")
}
