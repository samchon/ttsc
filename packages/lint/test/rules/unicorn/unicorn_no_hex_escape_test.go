package linthost

import "testing"

// TestRuleCorpusUnicornNoHexEscape verifies unicorn/no-hex-escape reports a
// string literal that contains a `\xHH` escape.
//
// The parser decodes escapes into `.Text`, so the rule reads raw source
// via `nodeText` and matches `\xHH` against the literal's source span.
// `\xA9` (the © glyph) is the canonical example and pins the regex
// branch.
//
// 1. Enable unicorn/no-hex-escape via an expect annotation.
// 2. Declare a const initialized to the literal `"\xA9"`.
// 3. Assert the literal is reported.
func TestRuleCorpusUnicornNoHexEscape(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-hex-escape.ts", "// expect: unicorn/no-hex-escape error\nconst s = \"\\xA9\";\n")
}
