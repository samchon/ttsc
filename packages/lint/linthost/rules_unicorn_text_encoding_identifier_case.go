// unicorn/text-encoding-identifier-case: the IANA/WHATWG text-encoding labels
// `utf8`, `UTF-8`, `ascii`, etc. all resolve to the same encoding in browsers
// and Node, but the ecosystem varies on which spelling it echoes back. Picking
// one canonical form keeps string-equality checks against those echoes stable.
//
// Upstream parity (verified against `rules/text-encoding-identifier-case.js`):
// only `utf-8`/`utf8` and `ascii` are handled — every other label passes
// through untouched. The canonical form defaults to the dash-less `utf8`; the
// dashed WHATWG spelling `utf-8` is enforced only when the `withDash` option is
// set or the literal sits in a context that demands it: `new TextDecoder(...)`,
// a JSX `<meta charset>`, or a JSX `<form accept-charset>` attribute. `ascii`
// is always canonical lowercase.
//
// Only `fs.readFile()` / `fs.readFileSync()`'s encoding argument is auto-fixed;
// every other position offers an editor suggestion instead, matching upstream's
// fix-vs-suggestion split.
//
// AST-only: visit `StringLiteral` and `NoSubstitutionTemplateLiteral`. Matching
// and rewriting both run on the raw text between the delimiters (upstream's
// `node.raw.slice(1, -1)` / `replaceStringRaw`), so an escaped spelling such as
// `"utf-8"` is left alone and a fix never disturbs the quotes.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/text-encoding-identifier-case.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

const unicornTextEncodingIdentifierCaseRuleName = "unicorn/text-encoding-identifier-case"

type unicornTextEncodingIdentifierCase struct{}

// unicornTextEncodingIdentifierCaseOptions decodes the single `{withDash}`
// option slot. `withDash: true` prefers the dashed WHATWG spelling (`utf-8`)
// everywhere; the default (`false`) prefers `utf8` outside the dash-only
// contexts.
type unicornTextEncodingIdentifierCaseOptions struct {
  WithDash bool `json:"withDash"`
}

func (unicornTextEncodingIdentifierCase) Name() string {
  return unicornTextEncodingIdentifierCaseRuleName
}
func (unicornTextEncodingIdentifierCase) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral}
}
func (unicornTextEncodingIdentifierCase) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  // Upstream's getStringLiteralValue rejects a template literal whose parent is
  // a TaggedTemplateExpression (`String.raw`utf8``): the tag owns the raw text.
  if node.Kind == shimast.KindNoSubstitutionTemplateLiteral &&
    node.Parent != nil && node.Parent.Kind == shimast.KindTaggedTemplateExpression {
    return
  }
  source := ctx.File.Text()
  innerStart, innerEnd, ok := unicornTextEncodingInnerRange(source, node)
  if !ok {
    return
  }
  value := source[innerStart:innerEnd]
  if value == "" {
    return
  }
  // Bail before decoding options or walking the parent chain unless the label
  // is one the rule handles: `withDash` never turns an unknown label into a
  // match, so an early reject here is behavior-preserving.
  if unicornTextEncodingReplacement(value, false) == "" {
    return
  }

  var options unicornTextEncodingIdentifierCaseOptions
  _ = ctx.DecodeOptions(&options)
  withDash := options.WithDash || unicornTextEncodingShouldEnforceDash(node)

  replacement := unicornTextEncodingReplacement(value, withDash)
  if replacement == "" || replacement == value {
    return
  }

  edit := TextEdit{Pos: innerStart, End: innerEnd, Text: replacement}
  message := "Prefer `" + replacement + "` over `" + value + "`."
  if unicornTextEncodingIsFsReadFileEncoding(node) {
    // `fs.{readFile,readFileSync}` is the one auto-fixed position upstream.
    ctx.ReportFix(node, message, edit)
    return
  }
  title := "Replace `" + value + "` with `" + replacement + "`."
  ctx.ReportSuggestion(node, message, title, edit)
}

// unicornTextEncodingReplacement ports upstream's `getReplacement`: only
// `utf-8`/`utf8` (→ `utf-8` when dashed, else `utf8`) and `ascii` are known;
// any other label yields "" (no replacement). The comparison is
// case-insensitive so `UTF-8`, `Utf8`, and `ASCII` all normalize.
func unicornTextEncodingReplacement(encoding string, withDash bool) string {
  switch strings.ToLower(encoding) {
  case "utf-8", "utf8":
    if withDash {
      return "utf-8"
    }
    return "utf8"
  case "ascii":
    return "ascii"
  }
  return ""
}

// unicornTextEncodingShouldEnforceDash reports the contexts where the dashed
// WHATWG spelling is required regardless of the `withDash` option: the first
// argument of `new TextDecoder(...)`, a JSX `<meta charset>` attribute value,
// or a JSX `<form accept-charset>` attribute value.
func unicornTextEncodingShouldEnforceDash(node *shimast.Node) bool {
  if node == nil || node.Parent == nil {
    return false
  }
  if node.Parent.Kind == shimast.KindNewExpression {
    if newExpr := node.Parent.AsNewExpression(); newExpr != nil &&
      identifierText(newExpr.Expression) == "TextDecoder" &&
      newExpr.Arguments != nil && len(newExpr.Arguments.Nodes) > 0 &&
      newExpr.Arguments.Nodes[0] == node {
      return true
    }
  }
  return unicornTextEncodingIsJsxCharsetAttribute(node)
}

// unicornTextEncodingIsJsxCharsetAttribute matches `<meta charset="...">` and
// `<form accept-charset="...">` (React's camelCase `acceptCharset` included),
// where `node` is the attribute's string-literal initializer.
func unicornTextEncodingIsJsxCharsetAttribute(node *shimast.Node) bool {
  attr := node.Parent
  if attr == nil || attr.Kind != shimast.KindJsxAttribute {
    return false
  }
  jsxAttr := attr.AsJsxAttribute()
  if jsxAttr == nil || jsxAttr.Initializer != node {
    return false
  }
  attrs := attr.Parent
  if attrs == nil || attrs.Kind != shimast.KindJsxAttributes {
    return false
  }
  var tagName *shimast.Node
  switch element := attrs.Parent; {
  case element == nil:
    return false
  case element.Kind == shimast.KindJsxOpeningElement:
    if opening := element.AsJsxOpeningElement(); opening != nil {
      tagName = opening.TagName
    }
  case element.Kind == shimast.KindJsxSelfClosingElement:
    if selfClosing := element.AsJsxSelfClosingElement(); selfClosing != nil {
      tagName = selfClosing.TagName
    }
  default:
    return false
  }
  attrName := strings.ToLower(jsxAttrName(jsxAttr.Name()))
  switch strings.ToLower(jsxTagName(tagName)) {
  case "meta":
    return attrName == "charset"
  case "form":
    return attrName == "acceptcharset" || attrName == "accept-charset"
  }
  return false
}

// unicornTextEncodingIsFsReadFileEncoding matches the encoding argument of a
// non-optional `obj.readFile(...)` / `obj.readFileSync(...)` call — `node` is
// the second argument and the first is not a spread. Mirrors upstream's
// `isMethodCall(..., {optionalCall:false, optionalMember:false})` plus the
// `arguments[1] === node && arguments[0].type !== 'SpreadElement'` guards.
func unicornTextEncodingIsFsReadFileEncoding(node *shimast.Node) bool {
  if node == nil || node.Parent == nil || node.Parent.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.Parent.AsCallExpression()
  if call == nil || call.QuestionDotToken != nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil || access.QuestionDotToken != nil {
    return false
  }
  if method := identifierText(access.Name()); method != "readFile" && method != "readFileSync" {
    return false
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) < 2 ||
    call.Arguments.Nodes[1] != node ||
    call.Arguments.Nodes[0].Kind == shimast.KindSpreadElement {
    return false
  }
  return true
}

// unicornTextEncodingInnerRange bounds the raw text between the quote or
// backtick delimiters of a string / no-substitution-template literal, mirroring
// upstream's `[range[0]+1, range[1]-1]` arithmetic.
func unicornTextEncodingInnerRange(source string, node *shimast.Node) (int, int, bool) {
  start := shimscanner.SkipTrivia(source, node.Pos())
  end := node.End()
  if start < 0 || end > len(source) || start+2 > end {
    return 0, 0, false
  }
  open := source[start]
  switch node.Kind {
  case shimast.KindStringLiteral:
    if open != '\'' && open != '"' {
      return 0, 0, false
    }
    if source[end-1] != open {
      return 0, 0, false
    }
  case shimast.KindNoSubstitutionTemplateLiteral:
    if open != '`' || source[end-1] != '`' {
      return 0, 0, false
    }
  default:
    return 0, 0, false
  }
  return start + 1, end - 1, true
}

func init() {
  Register(unicornTextEncodingIdentifierCase{})
}
