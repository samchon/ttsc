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
// length guards must run first; upstream never sees these files at all, and a
// half-typed path in an editor buffer must not advise a `String.raw`
// conversion of a literal that does not exist yet.
//
//  1. Lint an unterminated string and an unterminated template, both carrying
//     the `\\` escapes the rule keys on.
//  2. Lint the degenerate one-byte tokens: a lone quote and a lone backtick at
//     end of file.
//  3. Assert every one of them is silent.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper runs Engine.Run and verifies unterminated strings/templates and one-byte lone delimiters remain silent without an out-of-bounds token slice; annotated rule/severity/line equality or explicit zero count rejects extra findings.
// @evidence contracts/testing.md#independent-expectations Four authored zero-finding expectations express the editor-buffer safety contract for recovered malformed AST tokens; upstream does not execute malformed parser input, and these silence oracles are independent of the Go delimiter and slice guards.
// @evidence contracts/testing.md#distinguishing-cases The four authored malformed inputs require zero findings; valid complete backslash payload is the positive TestRuleCorpusUnicornPreferStringRaw.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferStringRawSurvivesUnterminatedLiterals is a discoverable Go unit entry; its source fixtures run owning AST/engine operations in the shared Go process without installed consumers, native builds or product hosts. Corpus failure output retains the virtual source identity and expected/actual finding positions.
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
