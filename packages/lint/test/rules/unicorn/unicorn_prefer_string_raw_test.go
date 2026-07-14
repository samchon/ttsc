package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringRaw verifies the rule reports a
// string literal whose escapes are nothing but backslashes.
//
// The positive case the suppression guards must never swallow: every escape
// in the literal is `\\`, so `String.raw` respells the value character for
// character. A Windows-shaped path is the canonical example and the minimal
// positive case.
//
// 1. Enable unicorn/prefer-string-raw via an expect annotation.
// 2. Write a string literal whose only escapes are `\\` (`"C:\\Users\\me"`).
// 3. Assert the string literal is reported.
func TestRuleCorpusUnicornPreferStringRaw(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-string-raw.ts", "// expect: unicorn/prefer-string-raw error\nconst p = \"C:\\\\Users\\\\me\";\n")
}
