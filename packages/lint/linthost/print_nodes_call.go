package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// printCallExpression renders a CallExpression with width-aware
// argument reflow. The callee, optional question token (`?.`) and
// optional type-argument list are emitted verbatim — only the
// argument list participates in reflow.
//
// Flat:    `foo(a, b, c)`
// Broken:  `foo(
//
//     a,
//     b,
//     c,
//  )`
//
// Type arguments (`foo<A, B>(x)`) are preserved verbatim. Trailing
// commas on type arguments are intentionally avoided — Prettier omits
// them too (see prettier#10353).
//
// The second return value is the `covered` flag: see PrintNode. The
// callee, optional `?.` token and type arguments are verbatim, so a
// multi-line callee taints coverage just as a multi-line argument does.
func printCallExpression(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  call := node.AsCallExpression()
  if call == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  parts := []Doc{}
  covered := true
  if call.Expression != nil {
    parts = append(parts, verbatim(ctx, call.Expression))
    covered = covered && !nodeSpansMultipleLines(ctx, call.Expression)
  }
  // Question-dot for optional call: `foo?.(x)`. The token byte range
  // lives between Expression.End() and the open paren; copy
  // verbatim if present.
  if call.QuestionDotToken != nil {
    parts = append(parts, verbatim(ctx, call.QuestionDotToken))
  }
  if call.TypeArguments != nil {
    // Verbatim range covering `<A, B>` punctuation and members.
    parts = append(parts, verbatimRange(ctx.Source, callTypeArgsStart(ctx, call), callTypeArgsEnd(ctx, call)))
  }
  if hasNilEntry(call.Arguments) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  argDoc, argCovered := printArgList(ctx, call.Arguments)
  parts = append(parts, argDoc)
  return Concat(parts...), covered && argCovered
}

// printNewExpression renders a NewExpression. It mirrors the call
// expression printer; the only difference is the leading `new ` keyword
// and the optional argument list (NewExpression may omit args entirely,
// e.g. `new Foo`).
//
// The second return value is the `covered` flag: see PrintNode.
func printNewExpression(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  ne := node.AsNewExpression()
  if ne == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  parts := []Doc{Text("new ")}
  covered := true
  if ne.Expression != nil {
    parts = append(parts, verbatim(ctx, ne.Expression))
    covered = covered && !nodeSpansMultipleLines(ctx, ne.Expression)
  }
  if ne.TypeArguments != nil {
    parts = append(parts, verbatimRange(ctx.Source, newTypeArgsStart(ctx, ne), newTypeArgsEnd(ctx, ne)))
  }
  if ne.Arguments != nil {
    if hasNilEntry(ne.Arguments) {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    argDoc, argCovered := printArgList(ctx, ne.Arguments)
    parts = append(parts, argDoc)
    covered = covered && argCovered
  }
  return Concat(parts...), covered
}

// hasNilEntry reports whether any entry of `list` is a nil pointer.
// Per-node printers consult this before delegating to printArgList /
// printList — a nil child would render as an empty Doc and produce
// `(a, , b)` in the output. Bailing to verbatim is byte-safe.
func hasNilEntry(list *shimast.NodeList) bool {
  if list == nil {
    return false
  }
  for _, n := range list.Nodes {
    if n == nil {
      return true
    }
  }
  return false
}

// printArgList renders an argument node list. The shared printList
// handles the open-comma-close shape; this helper gathers the
// per-argument docs and threads each argument's `covered` flag up.
//
// When the final argument is a block-bodied callback or object literal,
// the list renders in the "last-argument hugging" shape (see
// printListHuggingLast): the callback's own body carries the multi-line
// layout, so the parens stay attached and the preceding arguments are
// not exploded onto their own lines. This is the Prettier behavior for
// `foo(x, () => { … })`.
func printArgList(ctx *PrintContext, list *shimast.NodeList) (Doc, bool) {
  if list == nil {
    return Text("()"), true
  }
  items := make([]Doc, 0, len(list.Nodes))
  covered := true
  for _, arg := range list.Nodes {
    doc, childCovered := PrintNode(ctx, arg)
    covered = covered && childCovered
    items = append(items, doc)
  }
  shape := listShape{
    OpenTok:  "(",
    CloseTok: ")",
    Items:    items,
    Space:    false,
    AddComma: true,
    HugLast:  shouldHugLastArgument(list.Nodes),
  }
  return printList(ctx, shape), covered
}

// shouldHugLastArgument reports whether the final entry of `args` is a
// shape Prettier keeps hugging the closing paren: a block-bodied arrow
// function, a function expression, or an object literal. Hugging only
// applies when that argument is genuinely the last one; a callback in
// the middle of the list does not trigger the shape.
//
// An expression-bodied arrow (`(x) => x.id`) is deliberately excluded.
// Its body carries no internal break point, so the hugging shape — a
// flat `Concat` with no Group — would pin the whole call to one line
// even when that line overflows printWidth. Routing it through the
// normal list shape instead lets the argument list explode onto its
// own line when the call does not fit, which is what Prettier does.
func shouldHugLastArgument(args []*shimast.Node) bool {
  if len(args) == 0 {
    return false
  }
  last := args[len(args)-1]
  if last == nil {
    return false
  }
  switch last.Kind {
  case shimast.KindFunctionExpression,
    shimast.KindObjectLiteralExpression,
    shimast.KindArrayLiteralExpression:
    return true
  case shimast.KindArrowFunction:
    arrow := last.AsArrowFunction()
    if arrow == nil || arrow.Body == nil {
      return false
    }
    body := arrow.Body
    // `(x) => ({ … })` parenthesizes its object body; hug on the inner
    // expression, mirroring Prettier's couldExpandArg.
    if body.Kind == shimast.KindParenthesizedExpression {
      if p := body.AsParenthesizedExpression(); p != nil && p.Expression != nil {
        body = p.Expression
      }
    }
    switch body.Kind {
    case shimast.KindBlock,
      shimast.KindObjectLiteralExpression,
      shimast.KindArrayLiteralExpression:
      return true
    }
  }
  return false
}

// forceBreakFirstGroup returns `doc` with the first Group found in a
// left-to-right walk of its subtree forced broken, and reports whether
// one was found. printListHuggingLast uses it to commit a hugged
// argument — an object or array literal, possibly nested inside an
// arrow body (`(x) => ({ … })`) — to its multi-line shape. The caller
// guards the walk with flatten: it is only run on an item that has no
// hard line breaks of its own, so the first Group reached is the
// hugged literal itself, never an unrelated Group inside a block body.
func forceBreakFirstGroup(doc Doc) (Doc, bool) {
  switch doc.Kind {
  case docGroup:
    doc.Break = true
    return doc, true
  case docConcat, docIndent, docAlign:
    children := make([]Doc, len(doc.Children))
    copy(children, doc.Children)
    for i, child := range children {
      broken, done := forceBreakFirstGroup(child)
      if done {
        children[i] = broken
        doc.Children = children
        return doc, true
      }
    }
  }
  return doc, false
}

// Type-argument byte-range helpers. The shim's NodeList.End() points
// past the last argument; the surrounding `<` and `>` are not part of
// the list's range, so we have to scan around it.

// callTypeArgsStart returns the byte offset of the `<` that opens the
// type-argument list of a CallExpression. Returns -1 when absent.
func callTypeArgsStart(ctx *PrintContext, call *shimast.CallExpression) int {
  if call.TypeArguments == nil || len(call.TypeArguments.Nodes) == 0 {
    return -1
  }
  first := call.TypeArguments.Nodes[0]
  if first == nil {
    return -1
  }
  // `<` is the byte immediately before the first type argument
  // (modulo whitespace).
  pos := first.Pos()
  for i := pos - 1; i >= 0; i-- {
    if ctx.Source[i] == '<' {
      return i
    }
  }
  return -1
}

// callTypeArgsEnd returns the byte offset one past the closing `>` of a
// CallExpression's type-argument list. Returns -1 when absent.
func callTypeArgsEnd(ctx *PrintContext, call *shimast.CallExpression) int {
  if call.TypeArguments == nil {
    return -1
  }
  end := call.TypeArguments.End()
  for i := end; i < len(ctx.Source); i++ {
    if ctx.Source[i] == '>' {
      return i + 1
    }
  }
  return end
}

// newTypeArgsStart returns the byte offset of the `<` that opens the
// type-argument list of a NewExpression. Returns -1 when absent.
func newTypeArgsStart(ctx *PrintContext, ne *shimast.NewExpression) int {
  if ne.TypeArguments == nil || len(ne.TypeArguments.Nodes) == 0 {
    return -1
  }
  first := ne.TypeArguments.Nodes[0]
  if first == nil {
    return -1
  }
  pos := first.Pos()
  for i := pos - 1; i >= 0; i-- {
    if ctx.Source[i] == '<' {
      return i
    }
  }
  return -1
}

// newTypeArgsEnd returns the byte offset one past the closing `>` of a
// NewExpression's type-argument list. Returns -1 when absent.
func newTypeArgsEnd(ctx *PrintContext, ne *shimast.NewExpression) int {
  if ne.TypeArguments == nil {
    return -1
  }
  end := ne.TypeArguments.End()
  for i := end; i < len(ctx.Source); i++ {
    if ctx.Source[i] == '>' {
      return i + 1
    }
  }
  return end
}
