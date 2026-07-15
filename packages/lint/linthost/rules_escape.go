package linthost

import (
  "strings"
  "unicode/utf8"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noUselessEscape: flag backslashes that escape characters which do not
// require escaping. Inside string/template literals the meaningful
// escapes are limited to a fixed set; everywhere else the backslash is
// noise from a copy/paste accident or a confused author. ESLint
// canonical: https://eslint.org/docs/latest/rules/no-useless-escape
//
// The rule is `eslint:recommended` and ships a one-byte autofix that
// deletes the redundant backslash. We mirror that fixer when the byte
// after the backslash is ASCII; multi-byte UTF-8 sequences are left
// detection-only because byte-deletion in the middle of a code point
// would corrupt the file.
type noUselessEscape struct{}

func (noUselessEscape) Name() string { return "no-useless-escape" }
func (noUselessEscape) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindStringLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateHead,
    shimast.KindTemplateMiddle,
    shimast.KindTemplateTail,
    shimast.KindRegularExpressionLiteral,
  }
}
func (noUselessEscape) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  // Tagged templates expose the raw bytes of the template to the tag
  // function (`String.raw`, `dedent`, `gql`, `css`, …), so a backslash
  // that looks redundant to the JS lexer is meaningful at the tag
  // boundary. ESLint canonical skips a tagged template's own quasis, but a
  // literal merely nested inside a tag's substitution is not itself tagged
  // and stays checked — so this consults the literal's OWN enclosing
  // template, not any ancestor tag.
  if isTaggedTemplateElement(node) {
    return
  }
  // tsgo's `node.Pos()` points at the start of leading trivia; the regex
  // scanner relies on `raw[0] == '/'`, so we have to anchor on the
  // post-trivia token start. String/template scans tolerate leading
  // trivia bytes by accident, but using `tokenRange` for every branch
  // keeps reported offsets aligned with the actual literal.
  pos, end := tokenRange(ctx.File, node)
  if pos < 0 || pos >= end {
    return
  }
  raw := ctx.File.Text()[pos:end]
  // Determine quote/scan delimiters based on node kind so the
  // single-char escape whitelist matches ESLint per-context.
  switch node.Kind {
  case shimast.KindStringLiteral:
    reportStringEscapes(ctx, raw, pos, stringValidEscapes, false)
  case shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateHead,
    shimast.KindTemplateMiddle,
    shimast.KindTemplateTail:
    reportStringEscapes(ctx, raw, pos, templateValidEscapes, true)
  case shimast.KindRegularExpressionLiteral:
    reportRegexEscapes(ctx, raw, pos)
  }
}

const stringValidEscapes = "'\"\\bfnrtv0xuU\n\r"
const templateValidEscapes = "`'\"\\bfnrtv0xuU$\n\r"

// regexNonClassValidEscapes covers characters that are meaningful when
// preceded by `\` outside a character class — every regex meta-char plus
// the line terminators. Inside a `[...]` most of these characters lose
// their special meaning (`.`, `*`, `+`, `?`, `(`, `)`, `{`, `}`, `|`, `$`,
// `/` are all literal in a class), so the in-class allowlist is narrower:
// backslash, the class-delimiting `]`, the range operator `-`, and `^`
// (which would otherwise turn the class into a negation if the escape
// were stripped). Standard shorthand escapes (`\d`, `\w`, …) and the
// Unicode/hex/control escapes are handled separately in
// `isUselessRegexEscape` and apply in both contexts.
const regexNonClassValidEscapes = "^$\\.*+?()[]{}|/-\n\r"
const regexClassValidEscapes = "\\]-^\n\r"

// reportStringEscapes walks the raw source bytes of a string or template
// literal and reports each backslash whose following character is not in
// `whitelist`. `base` is the source offset of `raw[0]` so reported ranges
// translate to absolute file positions. The function issues an autofix
// (delete the backslash) for ASCII escapes; multi-byte sequences are
// reported without a fix to avoid corrupting UTF-8.
//
// `isTemplate` is true for `NoSubstitutionTemplateLiteral` and
// `TemplateHead`/`Middle`/`Tail` payloads. Inside a template, `\${` escapes
// the interpolation opener: stripping the backslash from `\${expr}` would
// either turn the literal text into an interpolation (corrupting the
// program) or — when the surrounding template already contains a real
// `${expr}` — produce TS syntax that no longer parses. The explicit guard
// here pins that exception so future tightening of `templateValidEscapes`
// cannot regress the corruption.
func reportStringEscapes(ctx *Context, raw string, base int, whitelist string, isTemplate bool) {
  if len(raw) < 2 {
    return
  }
  // Strip the enclosing quotes; first and last bytes are quote / backtick / `${` / `}`.
  // For TemplateHead/Middle/Tail the head/tail use backtick + `${`, but
  // every quoted form starts with one ASCII byte and ends with one or
  // two ASCII bytes — neither contains a meaningful backslash, so just
  // skip the first byte and stop one byte before the end.
  startSkip := 1
  endSkip := 1
  if raw[len(raw)-2] == '$' && raw[len(raw)-1] == '{' {
    endSkip = 2
  }
  for i := startSkip; i < len(raw)-endSkip; i++ {
    if raw[i] != '\\' {
      continue
    }
    if i+1 >= len(raw)-endSkip {
      return
    }
    next := raw[i+1]
    // Template-literal exception: `\${` escapes the interpolation
    // opener. Without the backslash the next two bytes would either
    // start an interpolation or trigger a parse error, so the escape is
    // load-bearing even though `\$` looks redundant in isolation.
    if isTemplate && next == '$' && i+2 < len(raw) && raw[i+2] == '{' {
      i++ // consume the `$` so the `{` is not re-examined as a fresh char.
      continue
    }
    if isUselessStringEscape(next, whitelist) {
      message := uselessEscapeMessage(raw[i+1:])
      // Only emit a fix when both surrounding bytes are plain ASCII so
      // deleting one byte cannot corrupt a multi-byte sequence.
      if next < 0x80 {
        ctx.ReportRangeFix(
          base+i,
          base+i+1,
          message,
          TextEdit{Pos: base + i, End: base + i + 1, Text: ""},
        )
      } else {
        ctx.ReportRange(base+i, base+i+1, message)
      }
    }
    i++ // skip the escaped char so `\\\\` doesn't double-report.
  }
}

// reportRegexEscapes walks the pattern body of a regex literal and reports
// backslashes that escape non-special characters. `base` is the source offset
// of `raw[0]`. Character-class context (`[…]`) widens the legal set slightly.
func reportRegexEscapes(ctx *Context, raw string, base int) {
  if len(raw) < 3 || raw[0] != '/' {
    return
  }
  // The regex pattern is between the leading `/` and the trailing
  // `/<flags>`; locate the closing slash by scanning right-to-left.
  closing := strings.LastIndexByte(raw, '/')
  if closing <= 0 {
    return
  }
  body := raw[1:closing]
  inClass := false
  for i := 0; i < len(body); i++ {
    ch := body[i]
    if ch == '[' && !inClass {
      inClass = true
      continue
    }
    if ch == ']' && inClass {
      inClass = false
      continue
    }
    if ch != '\\' || i+1 >= len(body) {
      continue
    }
    next := body[i+1]
    if isUselessRegexEscape(next, inClass) {
      // base + 1 (for the leading `/`) + i is the byte offset of the
      // backslash in the source.
      pos := base + 1 + i
      message := uselessEscapeMessage(body[i+1:])
      if next < 0x80 {
        ctx.ReportRangeFix(
          pos,
          pos+1,
          message,
          TextEdit{Pos: pos, End: pos + 1, Text: ""},
        )
      } else {
        ctx.ReportRange(pos, pos+1, message)
      }
    }
    i++ // consume the escaped character.
  }
}

// uselessEscapeMessage renders the diagnostic for one redundant backslash.
// `rest` is the raw source starting at the escaped character, of which only
// the leading UTF-8 rune is named. Decoding is required because the escape
// target may be multi-byte: converting the lone lead byte would reinterpret it
// as the code point of the same numeric value, so `\你` (lead byte 0xE4) would
// accuse `ä` (U+00E4). ESLint canonical names the whole code point as well.
// A byte that is not valid UTF-8 decodes to U+FFFD, which keeps the message
// itself well-formed.
func uselessEscapeMessage(rest string) string {
  escaped, _ := utf8.DecodeRuneInString(rest)
  return "Unnecessary escape character: \\" + string(escaped) + "."
}

// isUselessStringEscape reports whether a backslash before `ch` is redundant
// inside a string or template literal. The `whitelist` contains the characters
// that are valid escape targets for the specific literal kind (string vs template).
func isUselessStringEscape(ch byte, whitelist string) bool {
  // Whitespace + control chars are escape sequences too.
  if ch < 0x20 {
    return false
  }
  if strings.IndexByte(whitelist, ch) >= 0 {
    return false
  }
  // Digits 1-9 are octal-shaped (`no-octal-escape` owns those; `0` is in
  // the whitelist). Deleting the backslash of `\1`…`\7` changes the cooked
  // string value, and upstream ESLint skips backslash-digit entirely, so
  // `\8`/`\9` are exempt too for oracle parity.
  if ch >= '1' && ch <= '9' {
    return false
  }
  // ASCII letters that aren't in the whitelist are user-error escapes
  // like `\a`, `\m`. Punctuation that isn't in the whitelist (e.g., `\.`)
  // is also redundant.
  return true
}

// isUselessRegexEscape reports whether a backslash before `ch` is redundant
// in a regex pattern. `inClass` is true when the escape occurs inside a `[…]`
// character class, which narrows the set of meaningful meta-char escapes:
// most regex meta-chars (`.`, `*`, `+`, `?`, `(`, `)`, `{`, `}`, `|`, `^`,
// `$`, `/`) are literal inside a class, so escaping them there is noise.
func isUselessRegexEscape(ch byte, inClass bool) bool {
  if ch < 0x20 {
    return false
  }
  if inClass {
    if strings.IndexByte(regexClassValidEscapes, ch) >= 0 {
      return false
    }
  } else if strings.IndexByte(regexNonClassValidEscapes, ch) >= 0 {
    return false
  }
  // Common regex shorthand: \d \D \w \W \s \S \b \f \n \r \t \v \0 \x \u \c \p \P,
  // plus decimal back-references \1..\9. `\B` (non-word-boundary) and `\k<name>`
  // (named backref) are only meaningful outside a character class; `\q{...}` is
  // a v-flag string-disjunction escape that is also class-only-meaningful.
  switch ch {
  case 'd', 'D', 'w', 'W', 's', 'S', 'b', 'f', 'n', 'r', 't', 'v', '0',
    'x', 'u', 'c', 'p', 'P',
    '1', '2', '3', '4', '5', '6', '7', '8', '9':
    return false
  }
  if !inClass {
    switch ch {
    case 'B', 'k':
      return false
    }
  } else {
    if ch == 'q' {
      return false
    }
  }
  return true
}

func init() {
  Register(noUselessEscape{})
}
