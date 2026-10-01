// unicorn/consistent-template-literal-escape: a literal `${` inside a
// template can be spelled `\${` (escaped dollar), `$\{` (escaped brace),
// or `\$\{` (both). Every spelling cooks to the same text, so the parser
// erases the difference and a codebase silently mixes them. The upstream
// rule canonicalizes on `\${` and autofixes the other two spellings.
//
// Raw-source port: the two spellings are indistinguishable in the decoded
// `.Text` value, so the rule slices each template element's raw payload
// out of the file text between its delimiters (backtick or `}` on the
// left, `${` or backtick on the right) and rewrites every `$\{` whose
// optional leading backslash is preceded by an even-length backslash run,
// the exact lookbehind of the upstream regex. Tagged templates are
// skipped because the tag function observes `strings.raw`, where the
// spellings differ; template literal types are checked, matching what the
// upstream rule reports for `TemplateElement` nodes under the
// typescript-eslint parser.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-template-literal-escape.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

const unicornConsistentTemplateLiteralEscapeMessage = "Use `\\${` instead of `$\\{` to escape in template literals."

type unicornConsistentTemplateLiteralEscape struct{}

func (unicornConsistentTemplateLiteralEscape) Name() string {
  return "unicorn/consistent-template-literal-escape"
}
func (unicornConsistentTemplateLiteralEscape) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateExpression,
    shimast.KindTemplateLiteralType,
  }
}
func (unicornConsistentTemplateLiteralEscape) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  source := ctx.File.Text()
  switch node.Kind {
  case shimast.KindNoSubstitutionTemplateLiteral:
    if isTaggedTemplateQuasi(node) {
      return
    }
    unicornConsistentTemplateLiteralEscapeCheckElement(ctx, source, node)
  case shimast.KindTemplateExpression:
    if isTaggedTemplateQuasi(node) {
      return
    }
    expression := node.AsTemplateExpression()
    if expression == nil || expression.Head == nil || expression.TemplateSpans == nil {
      return
    }
    unicornConsistentTemplateLiteralEscapeCheckElement(ctx, source, expression.Head)
    for _, spanNode := range expression.TemplateSpans.Nodes {
      span := spanNode.AsTemplateSpan()
      if span == nil || span.Literal == nil {
        continue
      }
      unicornConsistentTemplateLiteralEscapeCheckElement(ctx, source, span.Literal)
    }
  case shimast.KindTemplateLiteralType:
    literalType := node.AsTemplateLiteralTypeNode()
    if literalType == nil || literalType.Head == nil || literalType.TemplateSpans == nil {
      return
    }
    unicornConsistentTemplateLiteralEscapeCheckElement(ctx, source, literalType.Head)
    for _, spanNode := range literalType.TemplateSpans.Nodes {
      span := spanNode.AsTemplateLiteralTypeSpan()
      if span == nil || span.Literal == nil {
        continue
      }
      unicornConsistentTemplateLiteralEscapeCheckElement(ctx, source, span.Literal)
    }
  }
}

// unicornConsistentTemplateLiteralEscapeCheckElement slices one template
// element's raw payload from the file text and reports the element with a
// payload-only autofix when canonicalization changes it. The reported
// range is the element token itself (opening delimiter through closing
// delimiter), which is exactly the ESTree TemplateElement range upstream
// highlights.
func unicornConsistentTemplateLiteralEscapeCheckElement(ctx *Context, source string, element *shimast.Node) {
  payloadStart, payloadEnd, ok := unicornConsistentTemplateLiteralEscapePayload(source, element)
  if !ok {
    return
  }
  fixed, changed := unicornConsistentTemplateLiteralEscapeRewrite(source[payloadStart:payloadEnd])
  if !changed {
    return
  }
  ctx.ReportFix(element, unicornConsistentTemplateLiteralEscapeMessage, TextEdit{
    Pos:  payloadStart,
    End:  payloadEnd,
    Text: fixed,
  })
}

// unicornConsistentTemplateLiteralEscapePayload returns the raw-text range
// strictly between an element token's delimiters. Head and
// no-substitution tokens open with a backtick, middle and tail tokens
// open with `}`; head and middle tokens close with `${`, tail and
// no-substitution tokens close with a backtick. Malformed shapes (e.g. an
// unterminated template at end of file) fail the delimiter guards and are
// skipped.
func unicornConsistentTemplateLiteralEscapePayload(source string, element *shimast.Node) (int, int, bool) {
  var opener byte
  closerWidth := 0
  switch element.Kind {
  case shimast.KindNoSubstitutionTemplateLiteral:
    opener, closerWidth = '`', 1
  case shimast.KindTemplateHead:
    opener, closerWidth = '`', 2
  case shimast.KindTemplateMiddle:
    opener, closerWidth = '}', 2
  case shimast.KindTemplateTail:
    opener, closerWidth = '}', 1
  default:
    return 0, 0, false
  }
  start := shimscanner.SkipTrivia(source, element.Pos())
  end := element.End()
  if start < 0 || end > len(source) || start+1+closerWidth > end || source[start] != opener {
    return 0, 0, false
  }
  if closerWidth == 2 && source[end-2:end] != "${" {
    return 0, 0, false
  }
  if closerWidth == 1 && source[end-1] != '`' {
    return 0, 0, false
  }
  return start + 1, end - closerWidth, true
}

// unicornConsistentTemplateLiteralEscapeRewrite canonicalizes every
// escaped-brace `${` spelling inside one raw template payload. It is the
// byte-scan equivalent of the upstream replacement
//
//  raw.replaceAll(/(?<=(?:^|[^\\])(?:\\\\)*)\\?\$\\{/g, "\\${")
//
// : a match consumes `$\{` or `\$\{` whose leading position follows an
// even-length backslash run, so escaped backslashes (`\\`) never donate
// their second byte to a match. Byte scanning is UTF-8 safe because every
// matched byte is ASCII and multibyte sequences contain no ASCII bytes.
func unicornConsistentTemplateLiteralEscapeRewrite(raw string) (string, bool) {
  var out strings.Builder
  changed := false
  backslashRun := 0
  index := 0
  for index < len(raw) {
    switch character := raw[index]; character {
    case '\\':
      if backslashRun%2 == 0 && strings.HasPrefix(raw[index:], `\$\{`) {
        out.WriteString(`\${`)
        changed = true
        index += len(`\$\{`)
        backslashRun = 0
        continue
      }
      backslashRun++
      out.WriteByte(character)
      index++
    case '$':
      if backslashRun%2 == 0 && strings.HasPrefix(raw[index:], `$\{`) {
        out.WriteString(`\${`)
        changed = true
        index += len(`$\{`)
        backslashRun = 0
        continue
      }
      backslashRun = 0
      out.WriteByte(character)
      index++
    default:
      backslashRun = 0
      out.WriteByte(character)
      index++
    }
  }
  if !changed {
    return raw, false
  }
  return out.String(), true
}

func init() {
  Register(unicornConsistentTemplateLiteralEscape{})
}
