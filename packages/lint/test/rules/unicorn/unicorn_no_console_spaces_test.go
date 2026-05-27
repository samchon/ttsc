package linthost

import "testing"

// TestRuleCorpusUnicornNoConsoleSpaces verifies unicorn/no-console-spaces
// reports `console.<method>` string-literal arguments with leading or
// trailing ASCII spaces.
//
// `console.log` already separates its arguments with one ASCII space, so an
// extra space inside the literal produces a doubled separator. The rule
// matches on identifier text (`console.log`/`warn`/`error`/`info`/`debug`/
// `trace`) and fires on the offending literal — this case pins the trailing-
// space arm on `"hello "`.
//
// 1. Enable unicorn/no-console-spaces via an expect annotation.
// 2. Call `console.log` with a trailing-space literal and a clean literal.
// 3. Assert the trailing-space literal is reported.
func TestRuleCorpusUnicornNoConsoleSpaces(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-console-spaces.ts", "// expect: unicorn/no-console-spaces error\nconsole.log(\"hello \", \"world\");\n")
}
