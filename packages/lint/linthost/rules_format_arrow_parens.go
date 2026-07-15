package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatArrowParens normalizes the parentheses around a single-parameter
// arrow function, mirroring Prettier's `arrowParens`:
//
//   - prefer "always" (Prettier default): a bare `x => x` gains parens,
//     becoming `(x) => x`.
//   - prefer "avoid": `(x) => x` drops them, becoming `x => x`.
//
// Only a single parameter that is a plain identifier with no type
// annotation, default, rest, optional `?`, or modifier is affected, every
// other shape (`(x: T)`, `({ x })`, `(...x)`, `(x = 1)`, `(x?)`, `(x, y)`,
// `()`) keeps its parentheses in both modes, exactly as Prettier does.
// `async x => x` is handled too: the modifier sits before the parameter, so
// the parameter-name span is unaffected. A legal trailing comma (`(x,) => x`)
// counts as already parenthesized — a trailing comma can only exist inside a
// parameter-list paren pair — so "always" leaves it alone and "avoid" deletes
// the comma together with the parens (`x => x`, matching Prettier).
//
// The rule rewrites only the parameter span (`x` <-> `(x)`), never the body
// or the `=>`, so a chained arrow `a => b => …` has each eligible arm
// normalized independently. Idempotent: a parameter already in the
// preferred shape compares equal and emits nothing.
type formatArrowParens struct{ optionsRule }

type formatArrowParensOptions struct {
  Prefer string `json:"prefer"`
}

func (formatArrowParens) Name() string   { return "format/arrow-parens" }
func (formatArrowParens) IsFormat() bool { return true }

func (formatArrowParens) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindArrowFunction}
}

func (formatArrowParens) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  arrow := node.AsArrowFunction()
  if arrow == nil || arrow.Parameters == nil {
    return
  }
  params := arrow.Parameters.Nodes
  if len(params) != 1 || params[0] == nil {
    return
  }
  param := params[0]
  if !isBareIdentifierParam(param) {
    return
  }
  // A type-parameter list (`<T>(x) => …`) forces the parameter parens in
  // both modes (a bare `<T>x =>` is not valid), so leave such an arrow
  // alone, its parens are mandatory, not stylistic.
  if arrow.TypeParameters != nil && len(arrow.TypeParameters.Nodes) > 0 {
    return
  }
  // A return-type annotation (`(x): T => …`) also requires the parens.
  if arrow.Type != nil {
    return
  }

  var opts formatArrowParensOptions
  _ = ctx.DecodeOptions(&opts)
  prefer := opts.Prefer
  if prefer != "avoid" {
    prefer = "always"
  }

  src := ctx.File.Text()
  nameStart := shimscanner.SkipTrivia(src, param.Pos())
  nameEnd := param.End()
  if nameStart < 0 || nameEnd <= nameStart || nameEnd > len(src) {
    return
  }

  // A comment in the parameter region (leading trivia, or between the name and
  // its `)`/`=>`) defeats the whitespace-only paren scan below: the scan stops
  // at the comment byte and reports "not wrapped", so the "always" branch would
  // wrap an already-parenthesized name a second time and emit invalid
  // `(/* c */ (x)) => x`. Prettier leaves such an arrow alone
  // (canPrintParamsWithoutParens requires `!hasComment(parameters[0])`), so
  // abstain rather than corrupt.
  if arrowParamRegionHasComment(src, param.Pos(), nameStart, nameEnd) {
    return
  }

  // Is the parameter already wrapped in `(` … `)`? Scan over whitespace on
  // each side; the sole parameter of an arrow is delimited by the
  // parameter-list parens when present. The forward scan starts at the
  // parameter *list*'s end, not the name's: the list span covers a legal
  // trailing comma (`(x,)` — that is how the AST records HasTrailingComma),
  // so a trailing-comma list is classified as wrapped instead of the `,`
  // byte aborting the scan and mis-reporting a bare name.
  openParen := scanBackForByte(src, nameStart, '(')
  closeParen := scanForwardForByte(src, arrow.Parameters.End(), ')')
  wrapped := openParen >= 0 && closeParen >= 0

  switch prefer {
  case "avoid":
    if !wrapped {
      return // already bare
    }
    // Replace `( … name … )` with just the name.
    ctx.ReportRangeFix(
      openParen,
      closeParen+1,
      "Single-parameter arrow should omit parentheses.",
      TextEdit{Pos: openParen, End: closeParen + 1, Text: src[nameStart:nameEnd]},
    )
  default: // always
    if wrapped {
      return // already parenthesized
    }
    ctx.ReportRangeFix(
      nameStart,
      nameEnd,
      "Single-parameter arrow should keep parentheses.",
      TextEdit{Pos: nameStart, End: nameEnd, Text: "(" + src[nameStart:nameEnd] + ")"},
    )
  }
}

// isBareIdentifierParam reports whether `param` is a plain identifier
// parameter: no rest `...`, no optional `?`, no type annotation, no default,
// no modifier (a parameter property), and an identifier name. Only such a
// parameter is eligible for arrow-paren normalization; every richer shape
// keeps its parentheses in both Prettier modes.
func isBareIdentifierParam(param *shimast.Node) bool {
  decl := param.AsParameterDeclaration()
  if decl == nil {
    return false
  }
  if decl.DotDotDotToken != nil || decl.QuestionToken != nil ||
    decl.Type != nil || decl.Initializer != nil {
    return false
  }
  if mods := param.Modifiers(); mods != nil && len(mods.Nodes) > 0 {
    return false
  }
  name := param.Name()
  return name != nil && name.Kind == shimast.KindIdentifier
}

// scanBackForByte returns the offset of the nearest `target` byte at or
// before `from`-1, scanning over whitespace only; -1 if a non-whitespace,
// non-target byte is reached first.
func scanBackForByte(src string, from int, target byte) int {
  for i := from - 1; i >= 0; i-- {
    c := src[i]
    if c == target {
      return i
    }
    if c != ' ' && c != '\t' && c != '\r' && c != '\n' {
      return -1
    }
  }
  return -1
}

// scanForwardForByte returns the offset of the nearest `target` byte at or
// after `from`, scanning over whitespace only; -1 if a non-whitespace,
// non-target byte is reached first.
func scanForwardForByte(src string, from int, target byte) int {
  for i := from; i < len(src); i++ {
    c := src[i]
    if c == target {
      return i
    }
    if c != ' ' && c != '\t' && c != '\r' && c != '\n' {
      return -1
    }
  }
  return -1
}

// arrowParamRegionHasComment reports whether a `//` or `/*` comment sits in the
// single parameter's region — its leading trivia (`[paramPos, nameStart)`) or
// the trailing trivia after the name up to the first real token (`)` or `=>`).
// The byte scan is safe here because a bare-identifier parameter region holds
// only comments, whitespace, the identifier, and parentheses (no strings:
// typed/defaulted params are already excluded by isBareIdentifierParam).
func arrowParamRegionHasComment(src string, paramPos, nameStart, nameEnd int) bool {
  for i := paramPos; i+1 < nameStart && i+1 < len(src); i++ {
    if src[i] == '/' && (src[i+1] == '*' || src[i+1] == '/') {
      return true
    }
  }
  // Trailing trivia after the identifier, up to `=>`. Tolerate one closing
  // paren so a comment between `)` and `=>` (`(x) /* c */ => x`) — which in
  // "avoid" mode would otherwise be stranded when the parens are stripped — is
  // also detected (Prettier keeps the parens of an arrow with such a dangling
  // comment). Likewise tolerate one trailing comma before the paren so a
  // comment on either side of it (`(x /* c */,) => x`, `(x, /* c */) => x`) —
  // which the "avoid" deletion would destroy — is also detected.
  sawComma := false
  sawParen := false
  for i := nameEnd; i+1 < len(src); i++ {
    c := src[i]
    if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
      continue
    }
    if c == '/' && (src[i+1] == '*' || src[i+1] == '/') {
      return true
    }
    if c == ',' && !sawComma && !sawParen {
      sawComma = true
      continue
    }
    if c == ')' && !sawParen {
      sawParen = true
      continue
    }
    break
  }
  return false
}

func init() {
  Register(formatArrowParens{})
}
