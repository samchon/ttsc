package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// formatQuotes normalizes string-literal quote style. Mirrors
// prettier's `singleQuote` option:
//
//   - `prefer: "double"` (default) converts single-quoted literals to
//     double-quoted when the escape cost is equal or better.
//   - `prefer: "single"` does the reverse.
//
// In both directions the escape-cost tie-breaker holds: if conversion
// would strictly increase the escape count, the literal is left alone.
//
// JSX attribute initializers (`<div className="foo" />`) are skipped on
// purpose. Prettier exposes a separate `jsxSingleQuote` option for that
// surface and never rewrites JSX attributes via `singleQuote`; the
// JSX-grammar-canonical form is double quotes and rewriting to single
// quotes corrupts working code. Template literals, no-substitution
// template literals, and JSX text nodes use distinct AST kinds and are
// also intentionally out of scope.
type formatQuotes struct{}

// formatQuotesOptions mirrors `TtscLintRuleOptions.Quotes`. Prefer accepts
// `"double"` (the default, enforces double quotes) or `"single"` (enforces
// single quotes). Any other value is treated as the default.
type formatQuotesOptions struct {
  Prefer string `json:"prefer"`
}

func (formatQuotes) Name() string   { return "format/quotes" }
func (formatQuotes) IsFormat() bool { return true }

func (formatQuotes) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindStringLiteral}
}

func (formatQuotes) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  // JSX attribute initializers parse as plain StringLiteral but are
  // grammatically required to use double quotes in the standard JSX
  // form. Prettier mirrors that and never touches them via singleQuote.
  if parent := node.Parent; parent != nil && parent.Kind == shimast.KindJsxAttribute {
    return
  }
  var opts formatQuotesOptions
  _ = ctx.DecodeOptions(&opts)
  preferSingle := opts.Prefer == "single"

  pos, end := tokenRange(ctx.File, node)
  if pos < 0 || end-pos < 2 {
    return
  }
  src := ctx.File.Text()
  raw := src[pos:end]
  if preferSingle {
    if raw[0] != '"' || raw[len(raw)-1] != '"' {
      return
    }
    converted, ok := convertDoubleQuotedToSingle(raw[1 : len(raw)-1])
    if !ok || converted == raw {
      return
    }
    ctx.ReportRangeFix(
      pos,
      end,
      "Strings must use single quotes.",
      TextEdit{Pos: pos, End: end, Text: converted},
    )
    return
  }
  if raw[0] != '\'' || raw[len(raw)-1] != '\'' {
    return
  }
  converted, ok := convertSingleQuotedToDouble(raw[1 : len(raw)-1])
  if !ok || converted == raw {
    return
  }
  ctx.ReportRangeFix(
    pos,
    end,
    "Strings must use double quotes.",
    TextEdit{Pos: pos, End: end, Text: converted},
  )
}

// convertDoubleQuotedToSingle walks the inner text of a double-quoted
// literal and returns the single-quoted equivalent, plus an `ok`
// boolean. `ok=false` means converting would require strictly more
// escapes than the source (prettier's tie-breaker rule), so the
// caller should leave the literal alone.
//
// Conversion is escape-aware:
//   - `\"` becomes a bare `"` (no longer needs escaping).
//   - Bare `'` becomes `\'` (now must be escaped).
//   - Every other escape sequence (`\n`, `\\`, `\u{…}`) survives intact.
func convertDoubleQuotedToSingle(inner string) (string, bool) {
  escapedDouble, unescapedSingle := countDoubleEscapes(inner)
  if unescapedSingle > escapedDouble {
    return "", false
  }
  var b strings.Builder
  b.Grow(len(inner) + 2)
  b.WriteByte('\'')
  for i := 0; i < len(inner); {
    if inner[i] == '\\' && i+1 < len(inner) {
      if inner[i+1] == '"' {
        b.WriteByte('"')
        i += 2
        continue
      }
      b.WriteByte(inner[i])
      b.WriteByte(inner[i+1])
      i += 2
      continue
    }
    if inner[i] == '\'' {
      b.WriteByte('\\')
      b.WriteByte('\'')
      i++
      continue
    }
    b.WriteByte(inner[i])
    i++
  }
  b.WriteByte('\'')
  return b.String(), true
}

// countDoubleEscapes returns the number of `\"` sequences and bare `'`
// bytes inside a double-quoted literal's text. Pairs with
// countSingleEscapes.
func countDoubleEscapes(inner string) (escapedDouble, unescapedSingle int) {
  for i := 0; i < len(inner); {
    if inner[i] == '\\' && i+1 < len(inner) {
      if inner[i+1] == '"' {
        escapedDouble++
      }
      i += 2
      continue
    }
    if inner[i] == '\'' {
      unescapedSingle++
    }
    i++
  }
  return escapedDouble, unescapedSingle
}

// convertSingleQuotedToDouble walks the inner text of a single-quoted
// literal and returns the double-quoted equivalent, plus an `ok`
// boolean. `ok=false` means converting would require strictly more
// escapes than the source (prettier's tie-breaker rule), so the
// caller should leave the literal alone.
//
// Conversion is escape-aware:
//   - `\'` becomes a bare `'` (no longer needs escaping).
//   - Bare `"` becomes `\"` (now must be escaped).
//   - Every other escape sequence (`\n`, `\\`, `\u{…}`) survives intact.
func convertSingleQuotedToDouble(inner string) (string, bool) {
  escapedSingle, unescapedDouble := countSingleEscapes(inner)
  if unescapedDouble > escapedSingle {
    return "", false
  }
  var b strings.Builder
  b.Grow(len(inner) + 2)
  b.WriteByte('"')
  for i := 0; i < len(inner); {
    if inner[i] == '\\' && i+1 < len(inner) {
      if inner[i+1] == '\'' {
        b.WriteByte('\'')
        i += 2
        continue
      }
      b.WriteByte(inner[i])
      b.WriteByte(inner[i+1])
      i += 2
      continue
    }
    if inner[i] == '"' {
      b.WriteByte('\\')
      b.WriteByte('"')
      i++
      continue
    }
    b.WriteByte(inner[i])
    i++
  }
  b.WriteByte('"')
  return b.String(), true
}

// countSingleEscapes returns the number of `\'` sequences and bare `"`
// bytes inside a single-quoted literal's text. Pairs with
// countDoubleEscapes; the names describe what they count (the quote kind
// that's been escape-prefixed).
func countSingleEscapes(inner string) (escapedSingle, unescapedDouble int) {
  for i := 0; i < len(inner); {
    if inner[i] == '\\' && i+1 < len(inner) {
      if inner[i+1] == '\'' {
        escapedSingle++
      }
      i += 2
      continue
    }
    if inner[i] == '"' {
      unescapedDouble++
    }
    i++
  }
  return escapedSingle, unescapedDouble
}

func init() {
  Register(formatQuotes{})
}
