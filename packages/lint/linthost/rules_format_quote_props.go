package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatQuoteProps normalizes quoting of object-literal property keys,
// mirroring Prettier's `quoteProps`:
//
//   - "as-needed" (default): drop the quotes from a string key that is a
//     valid identifier and not a numeric-looking key. `{ "foo": 1 }` becomes
//     `{ foo: 1 }`; `{ "bar-baz": 1 }` and `{ "123": 1 }` keep their quotes.
//   - "consistent": if ANY key in the object needs quotes, leave the object
//     alone; otherwise unquote every removable key.
//   - "preserve": never change quoting.
//
// Only quoted keys the rule can SAFELY unquote are ever touched: a string
// whose content is a plain ASCII identifier (letters, `_`, `$`, digits after
// the first) with no escapes. A key with escapes, unicode, a leading digit
// (numeric-looking), or any non-identifier byte is left quoted in every
// mode, so the rule can never produce an invalid key. Idempotent.
type formatQuoteProps struct{}

type formatQuotePropsOptions struct {
  Mode string `json:"mode"`
}

func (formatQuoteProps) Name() string   { return "format/quote-props" }
func (formatQuoteProps) IsFormat() bool { return true }

func (formatQuoteProps) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindObjectLiteralExpression}
}

func (formatQuoteProps) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  obj := node.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return
  }
  var opts formatQuotePropsOptions
  _ = ctx.DecodeOptions(&opts)
  mode := opts.Mode
  switch mode {
  case "consistent", "preserve", "as-needed":
  default:
    mode = "as-needed"
  }
  if mode == "preserve" {
    return
  }

  src := ctx.File.Text()

  // removable collects each quoted key that is safely unquotable, paired
  // with its bare identifier. anyMustStayQuoted records whether some quoted
  // key cannot be unquoted (drives "consistent").
  type removableKey struct {
    start, end int
    ident      string
  }
  var removable []removableKey
  anyMustStayQuoted := false

  for _, prop := range obj.Properties.Nodes {
    if prop == nil {
      continue
    }
    name := propertyKeyName(prop)
    if name == nil || name.Kind != shimast.KindStringLiteral {
      continue
    }
    ks := shimscanner.SkipTrivia(src, name.Pos())
    ke := name.End()
    if ks < 0 || ke <= ks || ke > len(src) {
      return // give up on the whole object rather than risk a partial edit
    }
    ident := unquotableIdentifier(src[ks:ke])
    if ident == "" {
      anyMustStayQuoted = true
      continue
    }
    removable = append(removable, removableKey{start: ks, end: ke, ident: ident})
  }

  if len(removable) == 0 {
    return
  }
  // In "consistent" mode, if any key must stay quoted, the whole object is
  // kept quoted, so unquote nothing.
  if mode == "consistent" && anyMustStayQuoted {
    return
  }

  var edits []TextEdit
  for _, k := range removable {
    edits = append(edits, TextEdit{Pos: k.start, End: k.end, Text: k.ident})
  }
  ctx.ReportRangeFix(
    edits[0].Pos,
    edits[0].End,
    "Object property key does not need quotes.",
    edits...,
  )
}

// propertyKeyName returns the static name node of an object-literal property
// (assignment, method, or accessor), or nil when it has no static name.
func propertyKeyName(prop *shimast.Node) *shimast.Node {
  switch prop.Kind {
  case shimast.KindPropertyAssignment:
    if p := prop.AsPropertyAssignment(); p != nil {
      return p.Name()
    }
  case shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor:
    return prop.Name()
  }
  return nil
}

// unquotableIdentifier returns the bare identifier a quoted string key can
// safely become, or "" when the key must stay quoted. `raw` includes the
// surrounding quotes. A key is unquotable only when its content is a plain
// ASCII identifier with no escapes, conservative on purpose: a
// numeric-looking key (`"123"`), a unicode key, an escaped key, or anything
// with a non-identifier byte stays quoted, matching Prettier's never
// unquoting `"123"` and guaranteeing the result is a valid bare key.
func unquotableIdentifier(raw string) string {
  if len(raw) < 2 {
    return ""
  }
  q := raw[0]
  if (q != '"' && q != '\'') || raw[len(raw)-1] != q {
    return ""
  }
  inner := raw[1 : len(raw)-1]
  if len(inner) == 0 {
    return ""
  }
  if inner == "__proto__" {
    // A bare `__proto__:` key in an object literal is the spec-special
    // prototype setter (sets [[Prototype]]), whereas a quoted `"__proto__"`
    // key is an ordinary own data property. Unquoting would change runtime
    // semantics, so keep it quoted (Prettier does the same).
    return ""
  }
  for i := 0; i < len(inner); i++ {
    c := inner[i]
    isLetter := (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || c == '$'
    isDigit := c >= '0' && c <= '9'
    if i == 0 {
      if !isLetter {
        return "" // leading digit (numeric-looking) or other byte: keep quoted
      }
    } else if !isLetter && !isDigit {
      return ""
    }
  }
  return inner
}

func init() {
  Register(formatQuoteProps{})
}
