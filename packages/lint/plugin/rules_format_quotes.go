package main

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// format/quotes normalizes string-literal quote style to double quotes,
// matching prettier's `singleQuote: false` default. Single-quoted
// literals convert to double-quoted iff conversion does not require
// strictly more escapes than the source form — the same heuristic
// prettier uses to avoid `'"'` ⇄ `"\""` thrashing.
//
// Template literals, no-substitution template literals, and JSX text
// nodes use distinct AST kinds and are intentionally out of scope.
type formatQuotes struct{}

func (formatQuotes) Name() string     { return "format/quotes" }
func (formatQuotes) IsFormat() bool   { return true }

func (formatQuotes) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindStringLiteral}
}

func (formatQuotes) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  pos, end := tokenRange(ctx.File, node)
  if pos < 0 || end-pos < 2 {
    return
  }
  src := ctx.File.Text()
  raw := src[pos:end]
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
  escapedSingle, unescapedDouble := countQuoteEscapes(inner)
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

func countQuoteEscapes(inner string) (escapedSingle, unescapedDouble int) {
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
