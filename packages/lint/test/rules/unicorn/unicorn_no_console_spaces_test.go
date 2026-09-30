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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a console string argument ends with redundant separator whitespace; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-console-spaces annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; console arguments omit the trailing separator whitespace. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoConsoleSpaces is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoConsoleSpaces(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-console-spaces.ts", "// expect: unicorn/no-console-spaces error\nconsole.log(\"hello \", \"world\");\n")
  assertRuleSkipsSource(t, "unicorn/no-console-spaces", "console.log(\"hello\", \"world\");\n")
}
