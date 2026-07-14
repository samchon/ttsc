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
