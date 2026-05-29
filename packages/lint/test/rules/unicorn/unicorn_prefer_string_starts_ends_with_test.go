package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringStartsEndsWith verifies
// unicorn/prefer-string-starts-ends-with reports the `s.slice(0, N) === "..."`
// shape.
//
// The rule walks the binary expression and matches either side carrying a
// `slice(0, N)` (or `slice(-N)`) call paired with a string literal whose length
// equals N. This fixture pins the canonical `startsWith` arm: a four-byte
// literal compared against `slice(0, 4)`.
//
// 1. Enable unicorn/prefer-string-starts-ends-with via an expect annotation.
// 2. Compare `s.slice(0, 4)` against `"http"`.
// 3. Assert the binary expression is reported.
func TestRuleCorpusUnicornPreferStringStartsEndsWith(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-string-starts-ends-with.ts", "declare const s: string;\n// expect: unicorn/prefer-string-starts-ends-with error\nconst b = s.slice(0, 4) === \"http\";\n")
}
