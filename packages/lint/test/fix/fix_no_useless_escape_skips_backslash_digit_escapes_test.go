package linthost

import "testing"

// TestFixNoUselessEscapeSkipsBackslashDigitEscapes verifies the digit
// exemption of `no-useless-escape` across every literal context.
//
// Deleting the backslash of an octal-shaped escape `\1`…`\7` changes the
// cooked string value (`"a\1b"` is "a\x01b", `"a1b"` is not), and upstream
// ESLint skips backslash-digit entirely — `no-octal-escape` owns those.
// This pins the `isUselessStringEscape` exemption for `\1`…`\9` in string
// and template literals (issue #361: the exemption was documented in a
// comment but never implemented, so the autofix silently corrupted
// script-mode strings), the `\0` whitelist boundary right below it —
// including `\0` followed by a digit, which the JS lexer reads as one
// octal escape — and the pre-existing regex back-reference exemption so
// no cleanup of `isUselessRegexEscape` can reintroduce the same class of
// corruption.
//
//  1. Parse string, template (no-substitution and tail), and regex
//     literals that carry backslash-digit escapes: `\1`/`\7`
//     (value-changing octals), `\0`/`\01` (whitelist boundary), `\8`/`\9`
//     (value-preserving but exempt for oracle parity), and a `\1`
//     back-reference in a regex.
//  2. Run only `no-useless-escape` and confirm zero findings — the fix
//     path is never reached.
//  3. Source stays byte-identical (no autofix applied).
func TestFixNoUselessEscapeSkipsBackslashDigitEscapes(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-useless-escape",
    "const octalOne = \"a\\1b\";\n"+
      "const octalSeven = \"a\\7b\";\n"+
      "const nul = \"\\0\";\n"+
      "const nulThenDigit = \"\\01\";\n"+
      "const eight = \"\\8\";\n"+
      "const nine = \"\\9\";\n"+
      "const tpl = `a\\1b`;\n"+
      "const tplTail = `${nul}\\7`;\n"+
      "const backref = /(a)\\1/;\n"+
      "JSON.stringify({octalOne,octalSeven,nul,nulThenDigit,eight,nine,tpl,tplTail,backref});\n",
  )
}
