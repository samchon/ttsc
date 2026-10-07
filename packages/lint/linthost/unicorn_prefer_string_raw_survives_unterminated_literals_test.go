package linthost

import "testing"

// TestUnicornPreferStringRawSurvivesUnterminatedLiterals verifies the rule
// reports nothing, and slices nothing out of bounds, on a recovered parse
// error.
//
// The lint engine walks whatever AST the parser recovers, so an unterminated
// literal reaches the rule as a token with no closing delimiter — in the
// degenerate case a lone quote or backtick, one byte long. The payload slice
// `source[pos+1 : end-1]` is invalid for such a token, so the delimiter and
// length guards must run first; a
// half-typed path in an editor buffer must not advise a `String.raw`
// conversion of a literal that does not exist yet.
//
//  1. Lint an unterminated string and an unterminated template, both carrying
//     the `\\` escapes the rule keys on.
//  2. Lint the degenerate one-byte tokens: a lone quote and a lone backtick at
//     end of file.
//  3. Assert every one of them is silent.
//
// @evidence contracts/testing.md#behavioral-verification The snapshot helper runs the actual parser and Engine.Run for unterminated strings/templates and one-byte lone delimiters; its ordinary-finding guard and zero count reject both a recovered rule panic and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations Four authored zero-finding expectations express the editor-buffer safety contract for recovered malformed AST tokens independently of the Go delimiter and slice guards.
// @evidence contracts/testing.md#distinguishing-cases The four authored malformed inputs require zero findings; valid complete backslash payload is the positive the corpus fixture unicorn-prefer-string-raw.ts.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferStringRawSurvivesUnterminatedLiterals is a discoverable Go unit entry; its source fixtures run owning AST/engine operations in the shared Go process without installed consumers, native builds or product hosts. The snapshot helper retains the authored source and reports unexpected findings.
func TestUnicornPreferStringRawSurvivesUnterminatedLiterals(t *testing.T) {
  for _, source := range []string{
    "const unterminatedString = \"C:\\\\Users\\\\me\n",
    "const unterminatedTemplate = `C:\\\\Users\\\\me\n",
    "const loneQuote = \"",
    "const loneBacktick = `",
  } {
    assertRuleSkipsSource(t, "unicorn/prefer-string-raw", source)
  }
}
