package linthost

import (
  "strings"
  "unicode"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatBracketSpacing normalizes the inner padding of single-line brace
// pairs, mirroring Prettier's `bracketSpacing`:
//
//   - prefer true (Prettier default): one space just inside the braces,
//     `{ x: 1 }`, `{ a, b }`, `import { foo } from "m"`.
//   - prefer false: no inner space, `{x: 1}`, `{a, b}`, `import {foo}`.
//
// It applies to object literals, object binding patterns (destructuring),
// named imports/exports, type literals, mapped types, and import attributes,
// the brace kinds Prettier's bracketSpacing governs. Block, class, interface,
// enum, and module braces are NOT affected (their layout is owned by the
// indentation rules).
//
// The rule touches only a brace pair that opens and closes on the SAME
// line: a multi-line container's interior is the indentation rules' surface,
// and an empty `{}` has no interior to pad. It rewrites just the whitespace
// run immediately inside each brace, so it never disturbs the contents.
// Idempotent: a pair already in the preferred shape compares equal.
type formatBracketSpacing struct{ optionsRule }

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
    shimast.KindMappedType,
    shimast.KindImportAttributes,
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
  if src[end-1] != '}' {
    return
  }
  // ImportAttributes begins at `with` or `assert`, not at its opening brace.
  // Every other supported kind begins with `{`. Restrict the fallback search
  // to that syntax node so a brace in an earlier expression cannot be chosen.
  if src[start] != '{' {
    for start < end && src[start] != '{' {
      start++
    }
    if start >= end {
      return
    }
  }
  inner := src[start+1 : end-1]
  if len(inner) == 0 {
    return // empty `{}`, nothing to pad
  }
  // Multi-line: the interior belongs to the indentation rules.
  for _, character := range inner {
    if character == '\n' || character == '\r' || character == '\u2028' || character == '\u2029' {
      return
    }
  }
  // Only-whitespace interior (`{   }`) is treated as empty: collapse to the
  // canonical empty form rather than padding nothing.
  trimmed := trimBracketSpacingWhitespace(inner)

  // Compute the desired interior: exactly one leading+trailing space when
  // spacing is on, none when off or when the container is empty.
  var want string
  if spacing && len(trimmed) != 0 {
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

// Trim ECMAScript horizontal trivia after excluding every line terminator.
func trimBracketSpacingWhitespace(s string) string {
  return strings.TrimFunc(s, func(character rune) bool {
    return unicode.Is(unicode.Zs, character) || character == '\t' ||
      character == '\v' || character == '\f' || character == '\uFEFF'
  })
}

func init() {
  Register(formatBracketSpacing{})
}
