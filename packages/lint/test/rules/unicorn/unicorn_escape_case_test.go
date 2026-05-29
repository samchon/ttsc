package linthost

import "testing"

// TestRuleCorpusUnicornEscapeCase verifies unicorn/escape-case reports a
// string literal whose `\xHH` escape uses lowercase hex digits.
//
// The parser decodes escape sequences into `.Text`, so the rule reads
// the raw source via `nodeText` and matches hex-escape patterns whose
// digits contain a lowercase a-f letter. `\xa9` (the lowercase form of
// the © glyph escape) pins the regex branch — uppercase `\xA9` passes.
//
// 1. Enable unicorn/escape-case via an expect annotation.
// 2. Declare a const initialized to `"\xa9"`.
// 3. Assert the literal is reported.
func TestRuleCorpusUnicornEscapeCase(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/escape-case.ts", "// expect: unicorn/escape-case error\nconst s = \"\\xa9\";\n")
}
