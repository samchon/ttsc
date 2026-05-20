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
func printCallExpression(ctx *PrintContext, node *shimast.Node) Doc {
  if node == nil {
    return Doc{}
  }
  call := node.AsCallExpression()
  if call == nil {
    return verbatim(ctx, node)
  }
  parts := []Doc{}
  if call.Expression != nil {
    parts = append(parts, verbatim(ctx, call.Expression))
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
    return verbatim(ctx, node)
  }
  parts = append(parts, printArgList(ctx, call.Arguments))
  return Concat(parts...)
}

// printNewExpression renders a NewExpression. It mirrors the call
// expression printer; the only difference is the leading `new ` keyword
// and the optional argument list (NewExpression may omit args entirely,
// e.g. `new Foo`).
func printNewExpression(ctx *PrintContext, node *shimast.Node) Doc {
  if node == nil {
    return Doc{}
  }
  ne := node.AsNewExpression()
  if ne == nil {
    return verbatim(ctx, node)
  }
  parts := []Doc{Text("new ")}
  if ne.Expression != nil {
    parts = append(parts, verbatim(ctx, ne.Expression))
  }
  if ne.TypeArguments != nil {
    parts = append(parts, verbatimRange(ctx.Source, newTypeArgsStart(ctx, ne), newTypeArgsEnd(ctx, ne)))
  }
  if ne.Arguments != nil {
    if hasNilEntry(ne.Arguments) {
      return verbatim(ctx, node)
    }
    parts = append(parts, printArgList(ctx, ne.Arguments))
  }
  return Concat(parts...)
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
// handles the open-comma-close shape; this helper just gathers the
// per-argument docs.
func printArgList(ctx *PrintContext, list *shimast.NodeList) Doc {
  if list == nil {
    return Text("()")
  }
  items := make([]Doc, 0, len(list.Nodes))
  for _, arg := range list.Nodes {
    doc, _ := PrintNode(ctx, arg)
    items = append(items, doc)
  }
  return printList(ctx, listShape{
    OpenTok:  "(",
    CloseTok: ")",
    Items:    items,
    Space:    false,
    AddComma: true,
  })
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
