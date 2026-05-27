package linthost

import "testing"

// TestRuleCorpusUnicornNoAbusiveEslintDisable verifies
// unicorn/no-abusive-eslint-disable reports a bare `/* eslint-disable */`
// directive with no rule list.
//
// The rule walks every comment in the file via the tsgo scanner and matches
// the stripped body against `^\s*eslint-disable(?:-next-line|-line)?\s*$`,
// so the fixture's block comment with no following rule name pins the
// minimal positive case and guards the scanner-driven comment iteration.
//
// 1. Enable unicorn/no-abusive-eslint-disable via an expect annotation.
// 2. Use a bare `// eslint-disable-next-line` directive on the next line.
//    The disable-next-line form keys suppression by the *following* source
//    line, so the rule's finding on the directive comment itself is not
//    silenced by the directive it reports on.
// 3. Assert the comment is reported at its source range.
func TestRuleCorpusUnicornNoAbusiveEslintDisable(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-abusive-eslint-disable.ts", "// expect: unicorn/no-abusive-eslint-disable error\n// eslint-disable-next-line\nconst _x = 0;\nvoid _x;\n")
}
