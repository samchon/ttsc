// escape_string.go ports eslint-plugin-unicorn's shared `escapeString` helper
// (`rules/utils/escape-string.js`), which delegates to the `quote-js-string`
// package. Every unicorn rule that rewrites a string literal from its cooked
// value routes the replacement through it — `unicorn/better-regex`'s
// `new RegExp("pattern", "flags")` branch and `unicorn/string-content`'s
// literal branch — so the two share one port here rather than drifting apart.
//
// quote-js-string source: https://github.com/sindresorhus/quote-js-string
package linthost

import (
  "strconv"
  "strings"
)

// escapeStringIsUnsafeRune reports the code points quote-js-string treats as
// unsafe to write raw into a JavaScript string literal: the C0 control range
// (<= U+001F), DEL (U+007F), the U+2028 / U+2029 line and paragraph separators
// (legal raw since ES2019, but line-oriented tooling still renders the literal
// as broken across lines), and lone surrogates (no valid UTF-8 encoding).
func escapeStringIsUnsafeRune(codePoint rune) bool {
  return codePoint <= 0x1F ||
    codePoint == 0x7F ||
    codePoint == 0x2028 ||
    codePoint == 0x2029 ||
    (codePoint >= 0xD800 && codePoint <= 0xDFFF)
}

// escapeString wraps `value` in `quote` (`'` or `"`) the way upstream's
// escapeString helper does. It escapes the backslash, the delimiter quote, and
// every unsafe code point — writing the named escapes `\n \r \t \b \f \v` where
// they apply and a braced ES6 code-point escape `\u{HEX}` (lowercase hex,
// `\u{0}` for NUL) for the rest. Escaping the line terminators is what keeps a
// cooked LF or CR from closing the literal early and corrupting the file.
//
// All other text passes through raw, exactly as upstream writes it: the
// non-delimiter quote characters, C1 controls above DEL, non-ASCII letters,
// exotic Unicode whitespace such as NBSP and the U+2000-U+200A group, and
// astral symbols. Lone surrogates cannot reach this function — the tsgo scanner
// cooks them to U+FFFD, which is safe and passes through like any other text.
func escapeString(value string, quote byte) string {
  var out strings.Builder
  out.Grow(len(value) + 2)
  out.WriteByte(quote)
  for _, character := range value {
    switch {
    case character == '\\':
      out.WriteString(`\\`)
    case character == rune(quote):
      out.WriteByte('\\')
      out.WriteByte(quote)
    case escapeStringIsUnsafeRune(character):
      switch character {
      case '\n':
        out.WriteString(`\n`)
      case '\r':
        out.WriteString(`\r`)
      case '\t':
        out.WriteString(`\t`)
      case '\b':
        out.WriteString(`\b`)
      case '\f':
        out.WriteString(`\f`)
      case '\v':
        out.WriteString(`\v`)
      default:
        out.WriteString(`\u{`)
        out.WriteString(strconv.FormatInt(int64(character), 16))
        out.WriteString(`}`)
      }
    default:
      out.WriteRune(character)
    }
  }
  out.WriteByte(quote)
  return out.String()
}
