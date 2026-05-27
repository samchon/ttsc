package linthost

import "testing"

// TestRuleCorpusUnicornPreventAbbreviations verifies
// unicorn/prevent-abbreviations reports the abbreviation `idx` in both
// declaration and reference positions.
//
// The rule visits every `Identifier`, lowercases the lexeme, and looks
// it up in a static MVP dictionary. There is no scope analysis — every
// occurrence of an abbreviated name is equally noisy — so this fixture
// pins both the declaration arm (parameter) and the reference arm (use)
// in one shot.
//
// 1. Enable unicorn/prevent-abbreviations via two stacked expect
//    annotations, one for each occurrence.
// 2. Declare a function `f(idx: number)` and read `idx` once inside the
//    body.
// 3. Assert the rule reports on both occurrences.
func TestRuleCorpusUnicornPreventAbbreviations(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prevent-abbreviations.ts", "// expect: unicorn/prevent-abbreviations error\nfunction f(idx: number) {\n  // expect: unicorn/prevent-abbreviations error\n  void idx;\n}\n")
}
