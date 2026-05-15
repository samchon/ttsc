package main

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// no-useless-escape: flag backslashes that escape characters which do not
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
  // boundary. ESLint canonical skips tagged templates entirely.
  if isInsideTaggedTemplate(node) {
    return
  }
  src := ctx.File.Text()
  pos := node.Pos()
  end := node.End()
  if pos < 0 || end > len(src) || pos >= end {
    return
  }
  raw := src[pos:end]
  // Determine quote/scan delimiters based on node kind so the
  // single-char escape whitelist matches ESLint per-context.
  switch node.Kind {
  case shimast.KindStringLiteral:
    reportStringEscapes(ctx, raw, pos, stringValidEscapes)
  case shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateHead,
    shimast.KindTemplateMiddle,
    shimast.KindTemplateTail:
    reportStringEscapes(ctx, raw, pos, templateValidEscapes)
  case shimast.KindRegularExpressionLiteral:
    reportRegexEscapes(ctx, raw, pos)
  }
}

const stringValidEscapes = "'\"\\bfnrtv0xuU\n\r"
const templateValidEscapes = "`'\"\\bfnrtv0xuU$\n\r"

// regexValidEscapes covers characters that are *always* meaningful when
// preceded by `\` in a regex pattern. Character classes and group syntax
// inside a regex add more legitimate escapes (`\d`, `\w`, …); we handle
// those by allowing every ASCII letter (which makes the fix conservative
// — it never deletes a backslash whose meaning could be context-sensitive).
const regexValidEscapes = "^$\\.*+?()[]{}|/-\n\r"

func reportStringEscapes(ctx *Context, raw string, base int, whitelist string) {
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
    if isUselessStringEscape(next, whitelist) {
      // Only emit a fix when both surrounding bytes are plain ASCII so
      // deleting one byte cannot corrupt a multi-byte sequence.
      if next < 0x80 {
        ctx.ReportRangeFix(
          base+i,
          base+i+1,
          "Unnecessary escape character: \\"+string(next)+".",
          TextEdit{Pos: base + i, End: base + i + 1, Text: ""},
        )
      } else {
        ctx.ReportRange(
          base+i,
          base+i+1,
          "Unnecessary escape character: \\"+string(next)+".",
        )
      }
    }
    i++ // skip the escaped char so `\\\\` doesn't double-report.
  }
}

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
      if next < 0x80 {
        ctx.ReportRangeFix(
          pos,
          pos+1,
          "Unnecessary escape character: \\"+string(next)+".",
          TextEdit{Pos: pos, End: pos + 1, Text: ""},
        )
      } else {
        ctx.ReportRange(
          pos,
          pos+1,
          "Unnecessary escape character: \\"+string(next)+".",
        )
      }
    }
    i++ // consume the escaped character.
  }
}

func isUselessStringEscape(ch byte, whitelist string) bool {
  // Whitespace + control chars are escape sequences too.
  if ch < 0x20 {
    return false
  }
  if strings.IndexByte(whitelist, ch) >= 0 {
    return false
  }
  // ASCII letters that aren't in the whitelist are user-error escapes
  // like `\a`, `\m`. Digits 1-9 are octal-shaped (`no-octal-escape`
  // owns those). `0` is in the whitelist. Punctuation that isn't in the
  // whitelist (e.g., `\.`) is also redundant.
  return true
}

func isUselessRegexEscape(ch byte, inClass bool) bool {
  if ch < 0x20 {
    return false
  }
  // Regex meta-chars and their friends.
  if strings.IndexByte(regexValidEscapes, ch) >= 0 {
    return false
  }
  // Inside a character class `]`, `\`, and `-` are still meaningful
  // beyond the always-list; everything else stays useless.
  if inClass {
    switch ch {
    case ']', '\\', '-', 'b':
      return false
    }
  }
  // Common regex shorthand: \d \D \w \W \s \S \b \B \f \n \r \t \v \0
  switch ch {
  case 'd', 'D', 'w', 'W', 's', 'S', 'b', 'B', 'f', 'n', 'r', 't', 'v', '0',
    'x', 'u', 'c', 'p', 'P', 'k', 'q':
    return false
  }
  return true
}

// isInsideTaggedTemplate reports whether `node` is the template payload of
// a TaggedTemplateExpression. Two AST shapes reach here:
//
//   - `KindNoSubstitutionTemplateLiteral` — the direct child of a
//     TaggedTemplateExpression's Template slot.
//   - `KindTemplateHead/Middle/Tail` — wrapped in TemplateSpan and
//     TemplateExpression nodes; the TemplateExpression's parent is the
//     TaggedTemplateExpression.
func isInsideTaggedTemplate(node *shimast.Node) bool {
  if node == nil || node.Parent == nil {
    return false
  }
  parent := node.Parent
  if parent.Kind == shimast.KindTaggedTemplateExpression {
    return true
  }
  // Walk up at most two more hops to reach the TaggedTemplateExpression
  // for the spans family.
  for i := 0; i < 2 && parent.Parent != nil; i++ {
    parent = parent.Parent
    if parent.Kind == shimast.KindTaggedTemplateExpression {
      return true
    }
  }
  return false
}

func init() {
  Register(noUselessEscape{})
}
