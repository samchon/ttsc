package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// formatTrailingComma normalizes trailing commas on governed lists. It adds a
// comma to a multi-line list when the configured mode permits one and removes
// an existing comma when that mode forbids one.
//
// Scope (intentionally narrower than the closing-brace surface of TS):
//
//   - ArrayLiteralExpression           `[a, b]`
//   - ObjectLiteralExpression          `{ a: 1 }`
//   - CallExpression / NewExpression   `foo(a, b)` / `new Foo(a, b)`
//   - NamedImports / NamedExports      `import { a, b } from "x"`
//   - TupleType                        `[A, B]` at the type level
//   - EnumDeclaration                  `enum E { A, B }`
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
// Rest parameters (`...rest`) are explicitly skipped only when adding a
// comma: ECMAScript forbids a trailing comma after a rest element (TS1013).
// A legacy comma is not syntactically valid, so there is nothing for the
// removal path to preserve. The same restriction applies to rest binding
// patterns, which the rule does not visit at all.
//
// Destructuring assignment TARGETS are the one array/object-literal shape
// where the same rest restriction bites: `({ a, ...rest } = obj)` and
// `[a, ...rest] = arr` parse as ObjectLiteralExpression /
// ArrayLiteralExpression (not binding patterns) and are therefore visited,
// yet a trailing comma after their `AssignmentRestProperty` /
// `AssignmentRestElement` is a syntax error. `isRestAssignmentTargetLiteral`
// suppresses the insert for exactly those; a real value literal with a
// trailing spread (`{ a, ...o }`) and a non-rest target (`{ a, b } = obj`)
// both legally keep the comma.
//
// Unparenthesized arrow parameters (`a => …`) are also skipped: there is
// no parameter-list paren to anchor the comma against, and ECMAScript has
// no place to insert one. `findCloseTokenAfter` bails on the first
// non-trivia byte after the parameter's `End()` (the `=>` token), so the
// rule abstains without emitting an edit.
type formatTrailingComma struct{ optionsRule }

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
    shimast.KindEnumDeclaration,
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
  switch node.Kind {
  case shimast.KindArrayLiteralExpression:
    arr := node.AsArrayLiteralExpression()
    if arr == nil {
      return
    }
    if isRestAssignmentTargetLiteral(node) {
      return
    }
    normalizeTrailingComma(ctx, arr.Elements, node.End()-1, mode != "none")
  case shimast.KindObjectLiteralExpression:
    obj := node.AsObjectLiteralExpression()
    if obj == nil {
      return
    }
    if isRestAssignmentTargetLiteral(node) {
      return
    }
    normalizeTrailingComma(ctx, obj.Properties, node.End()-1, mode != "none")
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    if isDynamicImportCall(call) {
      // Prettier never emits a trailing comma inside a dynamic
      // `import(...)` argument list, even under trailingComma:"all", a
      // documented exception because the import() spec historically
      // rejected one. The printer half (print_nodes_call.go) honors the
      // same exception so the two rules agree on the reflowed shape.
      return
    }
    normalizeTrailingComma(ctx, call.Arguments, node.End()-1, mode == "all")
  case shimast.KindNewExpression:
    ne := node.AsNewExpression()
    if ne == nil || ne.Arguments == nil {
      return
    }
    normalizeTrailingComma(ctx, ne.Arguments, node.End()-1, mode == "all")
  case shimast.KindNamedImports:
    named := node.AsNamedImports()
    if named == nil {
      return
    }
    normalizeTrailingComma(ctx, named.Elements, node.End()-1, mode != "none")
  case shimast.KindNamedExports:
    named := node.AsNamedExports()
    if named == nil {
      return
    }
    normalizeTrailingComma(ctx, named.Elements, node.End()-1, mode != "none")
  case shimast.KindTupleType:
    tup := node.AsTupleTypeNode()
    if tup == nil {
      return
    }
    normalizeTrailingComma(ctx, tup.Elements, node.End()-1, mode != "none")
  case shimast.KindEnumDeclaration:
    decl := node.AsEnumDeclaration()
    if decl == nil {
      return
    }
    normalizeTrailingComma(ctx, decl.Members, node.End()-1, mode != "none")
  case shimast.KindFunctionDeclaration:
    fn := node.AsFunctionDeclaration()
    if fn == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, fn.Parameters, mode == "all")
  case shimast.KindFunctionExpression:
    fn := node.AsFunctionExpression()
    if fn == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, fn.Parameters, mode == "all")
  case shimast.KindArrowFunction:
    fn := node.AsArrowFunction()
    if fn == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, fn.Parameters, mode == "all")
  case shimast.KindMethodDeclaration:
    fn := node.AsMethodDeclaration()
    if fn == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, fn.Parameters, mode == "all")
  case shimast.KindConstructor:
    fn := node.AsConstructorDeclaration()
    if fn == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, fn.Parameters, mode == "all")
  case shimast.KindGetAccessor:
    fn := node.AsGetAccessorDeclaration()
    if fn == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, fn.Parameters, mode == "all")
  case shimast.KindSetAccessor:
    fn := node.AsSetAccessorDeclaration()
    if fn == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, fn.Parameters, mode == "all")
  case shimast.KindMethodSignature:
    sig := node.AsMethodSignatureDeclaration()
    if sig == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, sig.Parameters, mode == "all")
  case shimast.KindCallSignature:
    sig := node.AsCallSignatureDeclaration()
    if sig == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, sig.Parameters, mode == "all")
  case shimast.KindConstructSignature:
    sig := node.AsConstructSignatureDeclaration()
    if sig == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, sig.Parameters, mode == "all")
  case shimast.KindFunctionType:
    ft := node.AsFunctionTypeNode()
    if ft == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, ft.Parameters, mode == "all")
  case shimast.KindConstructorType:
    ct := node.AsConstructorTypeNode()
    if ct == nil {
      return
    }
    normalizeFunctionParameterComma(ctx, ct.Parameters, mode == "all")
  case shimast.KindTypeParameter:
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
    normalizeTrailingComma(ctx, list, closePos, mode != "none")
  }
}

// isDynamicImportCall reports whether a CallExpression is a dynamic
// `import(...)`: its callee is the `import` keyword itself, mirroring
// typescript-go's ast.IsImportCall. Prettier never emits a trailing
// comma inside a dynamic-import argument list, even under
// trailingComma:"all".
func isDynamicImportCall(call *shimast.CallExpression) bool {
  return call != nil &&
    call.Expression != nil &&
    call.Expression.Kind == shimast.KindImportKeyword
}

// normalizeTrailingComma aligns one bracket-delimited list with the configured
// policy. `closeBracketPos` points at its closing punctuation (for example the
// `]` of an array literal). Addition stays limited to multi-line lists, as
// Prettier does, while removal also handles a pre-existing single-line comma.
//
// "Multi-line" means the close bracket sits on a different line from the
// last element's end, not just "the list contains a newline somewhere".
// Prettier's `trailingComma: "all"` omits the comma whenever the close
// bracket is adjacent to the last element on the same line, even if the
// element itself is internally multi-line. The canonical shape is
// `JSON.stringify({ ... })` where the object argument spans many lines
// but `}` and `)` collapse onto one line; inserting `,)` there would be
// stylistically wrong and, for parameter rest-paths nearby, can shift
// later diagnostics.
func normalizeTrailingComma(ctx *Context, list *shimast.NodeList, closeBracketPos int, want bool) {
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
  comma := trailingCommaPos(src, last.End(), closeBracketPos)
  if comma >= 0 {
    if want {
      return
    }
    ctx.ReportRangeFix(
      comma,
      comma+1,
      "Trailing comma is not allowed by this trailingComma mode.",
      TextEdit{Pos: comma, End: comma + 1, Text: ""},
    )
    return
  }
  if !want || !rangeSpansMultipleLines(src, last.End(), closeBracketPos) {
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
func normalizeFunctionParameterComma(ctx *Context, list *shimast.NodeList, want bool) {
  if list == nil || len(list.Nodes) == 0 {
    return
  }
  if want && lastParameterIsRest(list) {
    return
  }
  src := ctx.File.Text()
  closePos := findCloseTokenAfter(src, list.End(), ')')
  if closePos < 0 {
    return
  }
  normalizeTrailingComma(ctx, list, closePos, want)
}

// isRestAssignmentTargetLiteral reports whether node is an object- or
// array-literal used as a destructuring ASSIGNMENT TARGET whose last
// element is a rest (`...x`). ECMAScript forbids a trailing comma after an
// `AssignmentRestElement` / `AssignmentRestProperty`, so neither this rule
// nor the print-width printer (which shares this helper) may add one there.
//
// The two-pronged guard is what keeps it from over-suppressing. Only a
// destructuring assignment target that ENDS in a rest is illegal:
//
//   - A real value literal with a trailing spread (`{ a, ...o }`,
//     `[a, ...rest]`) is not a target, so isDestructuringAssignmentTarget
//     returns false and the comma stays legal.
//   - A non-rest assignment target (`{ a, b } = obj`) fails the
//     last-element-is-rest check and keeps its comma.
//
// It handles nested targets (`[{ a, ...rest }] = arr`,
// `({ x: [a, ...rest] } = obj)`) and for-of/for-in assignment initializers
// through isDestructuringAssignmentTarget's ancestor walk.
func isRestAssignmentTargetLiteral(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindArrayLiteralExpression:
    arr := node.AsArrayLiteralExpression()
    if arr == nil || arr.Elements == nil || len(arr.Elements.Nodes) == 0 {
      return false
    }
    last := arr.Elements.Nodes[len(arr.Elements.Nodes)-1]
    if last == nil || last.Kind != shimast.KindSpreadElement {
      return false
    }
  case shimast.KindObjectLiteralExpression:
    obj := node.AsObjectLiteralExpression()
    if obj == nil || obj.Properties == nil || len(obj.Properties.Nodes) == 0 {
      return false
    }
    last := obj.Properties.Nodes[len(obj.Properties.Nodes)-1]
    if last == nil || last.Kind != shimast.KindSpreadAssignment {
      return false
    }
  default:
    return false
  }
  return isDestructuringAssignmentTarget(node)
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

// trailingCommaPos returns the offset of the comma immediately following a
// list's final item, skipping whitespace and comments. It deliberately does
// not scan through another token, so it cannot remove an item separator.
func trailingCommaPos(src string, start, end int) int {
  if start < 0 {
    start = 0
  }
  if end > len(src) {
    end = len(src)
  }
  for i := start; i < end; {
    c := src[i]
    if c == ',' {
      return i
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
    return -1
  }
  return -1
}

func init() {
  Register(formatTrailingComma{})
}
