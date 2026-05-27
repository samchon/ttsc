package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringRaw verifies the rule reports a
// string literal whose source contains escaped backslashes.
//
// The detection scans the literal's raw source bytes for the two-byte
// sequence `\\` — the escape form `String.raw` would let the author
// drop. A Windows-shaped path is the canonical example and the minimal
// positive case.
//
// 1. Enable unicorn/prefer-string-raw via an expect annotation.
// 2. Write a string literal with `\\` escapes (`"C:\\Users\\me"`).
// 3. Assert the string literal is reported.
func TestRuleCorpusUnicornPreferStringRaw(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-string-raw.ts", "// expect: unicorn/prefer-string-raw error\nconst p = \"C:\\\\Users\\\\me\";\n")
}
