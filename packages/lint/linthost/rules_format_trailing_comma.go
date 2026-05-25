package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// formatTrailingComma adds trailing commas to multi-line lists. Mirrors
// prettier's `trailingComma: "all"` default — *not* a tunable.
//
// Scope (intentionally narrower than the closing-brace surface of TS):
//
//   - ArrayLiteralExpression           `[a, b]`
//   - ObjectLiteralExpression          `{ a: 1 }`
//   - CallExpression / NewExpression   `foo(a, b)` / `new Foo(a, b)`
//   - NamedImports / NamedExports      `import { a, b } from "x"`
//   - TupleType                        `[A, B]` at the type level
//   - Function parameter lists         `function foo(a, b) {}` etc.,
//     including interface call/construct/method signatures and
//     `(a, b) => …` / `new (a, b) => …` function/constructor type
//     literals.
//   - Type-parameter declaration lists `<T, U>` at the declaration site
//     (prettier omits trailing commas on type-argument call sites such
//     as `foo<A, B>(…)`; see prettier PR #10353).
//
// Out of scope on purpose:
//
//   - Destructuring binding patterns. The last element may be a rest
//     pattern, where a trailing comma is a syntax error.
//   - JSX attribute lists. Prettier does not apply trailing commas there
//     either.
//
// Rest parameters (`...rest`) are explicitly skipped: ECMAScript forbids
// a trailing comma after a rest element (TS1013), so the rule must not
// insert one even when the rest parameter is the multi-line list's last
// element. The same restriction applies to rest binding patterns, which
// the rule does not visit at all.
//
// Unparenthesized arrow parameters (`a => …`) are also skipped: there is
// no parameter-list paren to anchor the comma against, and ECMAScript has
// no place to insert one. `findCloseTokenAfter` bails on the first
// non-trivia byte after the parameter's `End()` (the `=>` token), so the
// rule abstains without emitting an edit.
type formatTrailingComma struct{}

// formatTrailingCommaOptions mirrors `TtscLintRuleOptions.TrailingComma`.
type formatTrailingCommaOptions struct {
  Mode string `json:"mode"`
}

func (formatTrailingComma) Name() string   { return "format/trailing-comma" }
func (formatTrailingComma) IsFormat() bool { return true }

func (formatTrailingComma) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindArrayLiteralExpression,
    shimast.KindObjectLiteralExpression,
    shimast.KindCallExpression,
    shimast.KindNewExpression,
    shimast.KindNamedImports,
    shimast.KindNamedExports,
    shimast.KindTupleType,
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindConstructor,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindMethodSignature,
    shimast.KindCallSignature,
    shimast.KindConstructSignature,
    shimast.KindFunctionType,
    shimast.KindConstructorType,
    shimast.KindTypeParameter,
  }
}

func (formatTrailingComma) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  var opts formatTrailingCommaOptions
  _ = ctx.DecodeOptions(&opts)
  mode := opts.Mode
  if mode == "" {
    mode = "all"
  }
  if mode == "none" {
    return
  }
  switch node.Kind {
  case shimast.KindArrayLiteralExpression:
    arr := node.AsArrayLiteralExpression()
    if arr == nil {
      return
    }
    considerTrailingComma(ctx, arr.Elements, node.End()-1)
  case shimast.KindObjectLiteralExpression:
    obj := node.AsObjectLiteralExpression()
    if obj == nil {
      return
    }
    considerTrailingComma(ctx, obj.Properties, node.End()-1)
  case shimast.KindCallExpression:
    if mode == "es5" {
      return // prettier's es5 mode skips call arguments
    }
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    considerTrailingComma(ctx, call.Arguments, node.End()-1)
  case shimast.KindNewExpression:
    if mode == "es5" {
      return
    }
    ne := node.AsNewExpression()
    if ne == nil || ne.Arguments == nil {
      return
    }
    considerTrailingComma(ctx, ne.Arguments, node.End()-1)
  case shimast.KindNamedImports:
    named := node.AsNamedImports()
    if named == nil {
      return
    }
    considerTrailingComma(ctx, named.Elements, node.End()-1)
  case shimast.KindNamedExports:
    named := node.AsNamedExports()
    if named == nil {
      return
    }
    considerTrailingComma(ctx, named.Elements, node.End()-1)
  case shimast.KindTupleType:
    if mode == "es5" {
      return // tuple types are type-level; ES5 mode is runtime-only
    }
    tup := node.AsTupleTypeNode()
    if tup == nil {
      return
    }
    considerTrailingComma(ctx, tup.Elements, node.End()-1)
  case shimast.KindFunctionDeclaration:
    if mode == "es5" {
      return
    }
    fn := node.AsFunctionDeclaration()
    if fn == nil {
      return
    }
    considerFunctionParameterComma(ctx, fn.Parameters)
  case shimast.KindFunctionExpression:
    if mode == "es5" {
      return
    }
    fn := node.AsFunctionExpression()
    if fn == nil {
      return
    }
    considerFunctionParameterComma(ctx, fn.Parameters)
  case shimast.KindArrowFunction:
    if mode == "es5" {
      return
    }
    fn := node.AsArrowFunction()
    if fn == nil {
      return
    }
    considerFunctionParameterComma(ctx, fn.Parameters)
  case shimast.KindMethodDeclaration:
    if mode == "es5" {
      return
    }
    fn := node.AsMethodDeclaration()
    if fn == nil {
      return
    }
    considerFunctionParameterComma(ctx, fn.Parameters)
  case shimast.KindConstructor:
    if mode == "es5" {
      return
    }
    fn := node.AsConstructorDeclaration()
    if fn == nil {
      return
    }
    considerFunctionParameterComma(ctx, fn.Parameters)
  case shimast.KindGetAccessor:
    if mode == "es5" {
      return
    }
    fn := node.AsGetAccessorDeclaration()
    if fn == nil {
      return
    }
    considerFunctionParameterComma(ctx, fn.Parameters)
  case shimast.KindSetAccessor:
    if mode == "es5" {
      return
    }
    fn := node.AsSetAccessorDeclaration()
    if fn == nil {
      return
    }
    considerFunctionParameterComma(ctx, fn.Parameters)
  case shimast.KindMethodSignature:
    if mode == "es5" {
      return
    }
    sig := node.AsMethodSignatureDeclaration()
    if sig == nil {
      return
    }
    considerFunctionParameterComma(ctx, sig.Parameters)
  case shimast.KindCallSignature:
    if mode == "es5" {
      return
    }
    sig := node.AsCallSignatureDeclaration()
    if sig == nil {
      return
    }
    considerFunctionParameterComma(ctx, sig.Parameters)
  case shimast.KindConstructSignature:
    if mode == "es5" {
      return
    }
    sig := node.AsConstructSignatureDeclaration()
    if sig == nil {
      return
    }
    considerFunctionParameterComma(ctx, sig.Parameters)
  case shimast.KindFunctionType:
    if mode == "es5" {
      return
    }
    ft := node.AsFunctionTypeNode()
    if ft == nil {
      return
    }
    considerFunctionParameterComma(ctx, ft.Parameters)
  case shimast.KindConstructorType:
    if mode == "es5" {
      return
    }
    ct := node.AsConstructorTypeNode()
    if ct == nil {
      return
    }
    considerFunctionParameterComma(ctx, ct.Parameters)
  case shimast.KindTypeParameter:
    if mode == "es5" {
      return // type parameters postdate ES5; prettier es5 skips them
    }
    if node.Parent == nil {
      return
    }
    list := node.Parent.TypeParameterList()
    if list == nil || len(list.Nodes) == 0 || list.Nodes[len(list.Nodes)-1] != node {
      return
    }
    src := ctx.File.Text()
    closePos := findCloseTokenAfter(src, list.End(), '>')
    if closePos < 0 {
      return
    }
    considerTrailingComma(ctx, list, closePos)
  }
}

// considerTrailingComma reports a fix when the bracket-delimited list is
// multi-line and missing its trailing comma. `closeBracketPos` points at
// the closing punctuation byte itself (e.g. the `]` of an array literal).
//
// "Multi-line" means the close bracket sits on a different line from the
// last element's end — not just "the list contains a newline somewhere".
// Prettier's `trailingComma: "all"` omits the comma whenever the close
// bracket is adjacent to the last element on the same line, even if the
// element itself is internally multi-line. The canonical shape is
// `JSON.stringify({ ... })` where the object argument spans many lines
// but `}` and `)` collapse onto one line; inserting `,)` there would be
// stylistically wrong and, for parameter rest-paths nearby, can shift
// later diagnostics.
func considerTrailingComma(ctx *Context, list *shimast.NodeList, closeBracketPos int) {
  if list == nil || len(list.Nodes) == 0 {
    return
  }
  last := list.Nodes[len(list.Nodes)-1]
  if last == nil {
    return
  }
  src := ctx.File.Text()
  if closeBracketPos < 0 || closeBracketPos >= len(src) {
    return
  }
  if !rangeSpansMultipleLines(src, last.End(), closeBracketPos) {
    return
  }
  if rangeHasTrailingComma(src, last.End(), closeBracketPos) {
    return
  }
  ctx.ReportRangeFix(
    last.End()-1,
    last.End(),
    "Missing trailing comma.",
    TextEdit{Pos: last.End(), End: last.End(), Text: ","},
  )
}

// considerFunctionParameterComma reuses the same trailing-comma logic for
// a parameter list. The closing `)` lives between the parameter list's
// End() and the next non-trivia byte; rather than carry token positions
// around, the scanner walks forward in source until it finds the close
// paren.
//
// Rest parameters short-circuit the insert: `function f(a, ...rest,)` is
// a TS1013 syntax error. The rule peeks the last element's
// DotDotDotToken and bails when set, since the rest must remain the
// terminal element with no following comma.
func considerFunctionParameterComma(ctx *Context, list *shimast.NodeList) {
  if list == nil || len(list.Nodes) == 0 {
    return
  }
  if lastParameterIsRest(list) {
    return
  }
  src := ctx.File.Text()
  closePos := findCloseTokenAfter(src, list.End(), ')')
  if closePos < 0 {
    return
  }
  considerTrailingComma(ctx, list, closePos)
}

// lastParameterIsRest reports whether the parameter list ends with a
// rest element (`...rest`). ECMAScript syntax disallows a trailing
// comma after a rest element; the rule must not insert one.
func lastParameterIsRest(list *shimast.NodeList) bool {
  last := list.Nodes[len(list.Nodes)-1]
  if last == nil {
    return false
  }
  param := last.AsParameterDeclaration()
  if param == nil {
    return false
  }
  return param.DotDotDotToken != nil
}

// findCloseTokenAfter returns the byte offset of the first `target`
// punctuation byte immediately after `start`, allowing only whitespace
// and comments in between. Any other byte means the caller's expected
// close token is not the next non-trivia token, and the function returns
// -1.
//
// The strict "trivia-only" contract is load-bearing for the sole caller
// `considerFunctionParameterComma`. An unparenthesized arrow parameter
// `a => …` has no opening paren, so a looser scanner would walk past
// `=>` and the body and land on some unrelated `)` (e.g. the close of
// an outer call), causing the rule to insert a spurious `,` after the
// parameter and produce a syntax error like `a, =>`. Bailing on any
// non-trivia byte cleanly suppresses the rule in those cases.
func findCloseTokenAfter(src string, start int, target byte) int {
  for i := start; i < len(src); i++ {
    c := src[i]
    if c == target {
      return i
    }
    if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
      continue
    }
    if c == '/' && i+1 < len(src) {
      if src[i+1] == '/' {
        for i < len(src) && src[i] != '\n' {
          i++
        }
        continue
      }
      if src[i+1] == '*' {
        i += 2
        for i+1 < len(src) && !(src[i] == '*' && src[i+1] == '/') {
          i++
        }
        if i+1 < len(src) {
          i++ // step past '*/'
        }
        continue
      }
    }
    return -1
  }
  return -1
}

// rangeSpansMultipleLines reports whether the source between two byte
// offsets contains at least one `\n`.
func rangeSpansMultipleLines(src string, a, b int) bool {
  if a > b {
    a, b = b, a
  }
  if a < 0 {
    a = 0
  }
  if b > len(src) {
    b = len(src)
  }
  for i := a; i < b; i++ {
    if src[i] == '\n' {
      return true
    }
  }
  return false
}

// rangeHasTrailingComma scans the source between the last item's end and
// the close bracket. Returns true if a `,` is the first non-whitespace,
// non-comment byte. Comments after the trailing comma still count as
// "comma present".
func rangeHasTrailingComma(src string, start, end int) bool {
  if start < 0 {
    start = 0
  }
  if end > len(src) {
    end = len(src)
  }
  for i := start; i < end; {
    c := src[i]
    if c == ',' {
      return true
    }
    if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
      i++
      continue
    }
    if c == '/' && i+1 < end {
      if src[i+1] == '/' {
        for i < end && src[i] != '\n' {
          i++
        }
        continue
      }
      if src[i+1] == '*' {
        i += 2
        for i+1 < end && !(src[i] == '*' && src[i+1] == '/') {
          i++
        }
        if i+1 < end {
          i += 2
        }
        continue
      }
    }
    return false
  }
  return false
}

func init() {
  Register(formatTrailingComma{})
}
