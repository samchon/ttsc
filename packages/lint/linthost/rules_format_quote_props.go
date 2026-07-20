package linthost

import (
  "strconv"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatQuoteProps normalizes quoting of object keys and method/type-member
// names, mirroring Prettier's `quoteProps` except for the documented semantic
// preservation of `__proto__` and non-ASCII identifier keys:
//
//   - "as-needed" (default): drop the quotes from a string key that is a
//     valid identifier and not a numeric-looking key. `{ "foo": 1 }` becomes
//     `{ foo: 1 }`; `{ "bar-baz": 1 }` and `{ "123": 1 }` keep their quotes.
//   - "consistent": if ANY object key needs quotes, quote its removable
//     identifier siblings; otherwise unquote every removable key.
//   - "preserve": never change quoting.
//
// Only quoted keys the rule can SAFELY unquote are ever touched: a string
// whose content is a plain ASCII identifier (letters, `_`, `$`, digits after
// the first) with no escapes. A key with escapes, unicode, a leading digit
// (numeric-looking), or any non-identifier byte is left quoted in every
// mode, so the rule can never produce an invalid key. Class fields remain
// outside the surface because Prettier preserves their quoted spelling.
type formatQuoteProps struct{ optionsRule }

type formatQuotePropsOptions struct {
  Mode string `json:"mode"`
}

func (formatQuoteProps) Name() string   { return "format/quote-props" }
func (formatQuoteProps) IsFormat() bool { return true }

func (formatQuoteProps) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindObjectLiteralExpression,
    shimast.KindClassDeclaration,
    shimast.KindClassExpression,
    shimast.KindInterfaceDeclaration,
    shimast.KindTypeLiteral,
  }
}

func (formatQuoteProps) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  members, isObject := quotePropsMembers(node)
  if len(members) == 0 {
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
  // with its bare identifier. bare collects identifier keys that need quotes
  // when a mixed object is normalized under `consistent`.
  type removableKey struct {
    start, end int
    ident      string
  }
  type bareKey struct {
    start, end int
    text       string
  }
  var removable []removableKey
  var bare []bareKey
  anyMustStayQuoted := false

  for _, prop := range members {
    if prop == nil {
      continue
    }
    name := propertyKeyName(prop)
    if name == nil {
      continue
    }
    ks := shimscanner.SkipTrivia(src, name.Pos())
    ke := name.End()
    if ks < 0 || ke <= ks || ke > len(src) {
      return // give up on the whole holder rather than risk a partial edit
    }
    if name.Kind == shimast.KindIdentifier {
      bare = append(bare, bareKey{start: ks, end: ke, text: src[ks:ke]})
      continue
    }
    if name.Kind != shimast.KindStringLiteral {
      continue
    }
    ident := unquotableIdentifier(src[ks:ke])
    if ident == "" {
      anyMustStayQuoted = true
      continue
    }
    removable = append(removable, removableKey{start: ks, end: ke, ident: ident})
  }

  var edits []TextEdit
  // Prettier's consistency rule applies to object literals only. Class and
  // type members still follow the as-needed direction because they do not
  // form an object-key group in Prettier's printer.
  if mode == "consistent" && isObject && anyMustStayQuoted {
    for _, key := range bare {
      edits = append(edits, TextEdit{Pos: key.start, End: key.end, Text: strconv.Quote(key.text)})
    }
  } else {
    for _, key := range removable {
      edits = append(edits, TextEdit{Pos: key.start, End: key.end, Text: key.ident})
    }
  }
  if len(edits) == 0 {
    return
  }
  ctx.ReportRangeFix(
    edits[0].Pos,
    edits[0].End,
    "Object property key does not need quotes.",
    edits...,
  )
}

// quotePropsMembers returns the members whose static names are governed by
// Prettier's quoteProps option. Class fields are intentionally excluded:
// Prettier preserves their quoted spelling, while class methods, interface
// members, and type-literal members follow the normal as-needed rule.
func quotePropsMembers(node *shimast.Node) ([]*shimast.Node, bool) {
  if node == nil {
    return nil, false
  }
  switch node.Kind {
  case shimast.KindObjectLiteralExpression:
    if obj := node.AsObjectLiteralExpression(); obj != nil && obj.Properties != nil {
      return obj.Properties.Nodes, true
    }
  case shimast.KindClassDeclaration:
    if decl := node.AsClassDeclaration(); decl != nil && decl.Members != nil {
      return decl.Members.Nodes, false
    }
  case shimast.KindClassExpression:
    if expr := node.AsClassExpression(); expr != nil && expr.Members != nil {
      return expr.Members.Nodes, false
    }
  case shimast.KindInterfaceDeclaration:
    if decl := node.AsInterfaceDeclaration(); decl != nil && decl.Members != nil {
      return decl.Members.Nodes, false
    }
  case shimast.KindTypeLiteral:
    if literal := node.AsTypeLiteralNode(); literal != nil && literal.Members != nil {
      return literal.Members.Nodes, false
    }
  }
  return nil, false
}

// propertyKeyName returns the static name node of a member governed by
// quoteProps, or nil when the member has no static name or is a class field.
func propertyKeyName(prop *shimast.Node) *shimast.Node {
  switch prop.Kind {
  case shimast.KindPropertyAssignment:
    if p := prop.AsPropertyAssignment(); p != nil {
      return p.Name()
    }
  case shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindMethodSignature,
    shimast.KindPropertySignature:
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
    // semantics, so ttsc deliberately keeps it quoted even though Prettier
    // does not.
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
