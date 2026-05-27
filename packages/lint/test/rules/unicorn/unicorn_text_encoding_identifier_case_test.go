package linthost

import "testing"

// TestRuleCorpusUnicornTextEncodingIdentifierCase verifies
// unicorn/text-encoding-identifier-case reports a non-canonical
// spelling of a well-known text encoding label.
//
// `"UTF-8"` shares its lowercased label `utf-8` with the canonical
// form, but the literal text differs — the rule fires on the literal
// itself.
//
// 1. Enable unicorn/text-encoding-identifier-case via an expect annotation.
// 2. Assign a `"UTF-8"` literal to a constant.
// 3. Assert the literal is reported.
func TestRuleCorpusUnicornTextEncodingIdentifierCase(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/text-encoding-identifier-case.ts", "// expect: unicorn/text-encoding-identifier-case error\nconst enc = \"UTF-8\";\nvoid enc;\n")
}
