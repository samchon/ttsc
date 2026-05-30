package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatBracketSpacing normalizes the inner padding of single-line brace
// pairs, mirroring Prettier's `bracketSpacing`:
//
//   - prefer true (Prettier default): one space just inside the braces —
//     `{ x: 1 }`, `{ a, b }`, `import { foo } from "m"`.
//   - prefer false: no inner space — `{x: 1}`, `{a, b}`, `import {foo}`.
//
// It applies to object literals, object binding patterns (destructuring),
// named imports/exports, and type literals — the brace kinds Prettier's
// bracketSpacing governs. Block, class, interface, enum, and module braces
// are NOT affected (their layout is owned by the indentation rules).
//
// The rule touches only a brace pair that opens and closes on the SAME
// line: a multi-line container's interior is the indentation rules' surface,
// and an empty `{}` has no interior to pad. It rewrites just the whitespace
// run immediately inside each brace, so it never disturbs the contents.
// Idempotent: a pair already in the preferred shape compares equal.
type formatBracketSpacing struct{}

type formatBracketSpacingOptions struct {
  Spacing *bool `json:"spacing"`
}

func (formatBracketSpacing) Name() string   { return "format/bracket-spacing" }
func (formatBracketSpacing) IsFormat() bool { return true }

func (formatBracketSpacing) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindObjectLiteralExpression,
    shimast.KindObjectBindingPattern,
    shimast.KindNamedImports,
    shimast.KindNamedExports,
    shimast.KindTypeLiteral,
  }
}

func (formatBracketSpacing) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  var opts formatBracketSpacingOptions
  _ = ctx.DecodeOptions(&opts)
  spacing := true
  if opts.Spacing != nil {
    spacing = *opts.Spacing
  }

  src := ctx.File.Text()
  start := shimscanner.SkipTrivia(src, node.Pos())
  end := node.End()
  if start < 0 || end <= start || end > len(src) {
    return
  }
  // The node's first byte should be `{` and last `}`; a parenthesized or
  // otherwise-wrapped form is out of scope.
  if src[start] != '{' || src[end-1] != '}' {
    return
  }
  inner := src[start+1 : end-1]
  if len(inner) == 0 {
    return // empty `{}` — nothing to pad
  }
  // Multi-line: the interior belongs to the indentation rules.
  for i := 0; i < len(inner); i++ {
    if inner[i] == '\n' || inner[i] == '\r' {
      return
    }
  }
  // Only-whitespace interior (`{   }`) is treated as empty: collapse to the
  // canonical empty form rather than padding nothing.
  trimmed := trimASCIISpace(inner)
  if len(trimmed) == 0 {
    return
  }

  // Compute the desired interior: exactly one leading+trailing space when
  // spacing is on, none when off.
  var want string
  if spacing {
    want = " " + trimmed + " "
  } else {
    want = trimmed
  }
  if inner == want {
    return
  }
  ctx.ReportRangeFix(
    start+1,
    end-1,
    "Normalize brace spacing to match bracketSpacing.",
    TextEdit{Pos: start + 1, End: end - 1, Text: want},
  )
}

// trimASCIISpace strips leading and trailing spaces and tabs from s.
func trimASCIISpace(s string) string {
  i := 0
  for i < len(s) && (s[i] == ' ' || s[i] == '\t') {
    i++
  }
  j := len(s)
  for j > i && (s[j-1] == ' ' || s[j-1] == '\t') {
    j--
  }
  return s[i:j]
}

func init() {
  Register(formatBracketSpacing{})
}
