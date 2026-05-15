package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// AST → Doc dispatcher.
//
// The dispatcher is the bridge between the TypeScript-Go AST and the
// printer engine. It walks one node at a time and emits a Doc tree
// shaped to that node's grammar. Coverage is intentionally partial in
// v1; the verbatim fallback below guarantees that an un-handled node
// kind contributes its original source bytes verbatim, so the printer
// can be wired up to a rule without breaking files that happen to use
// shapes the per-node printers don't yet understand.
//
// The price of verbatim fallback is that reflow stops at the boundary
// of an un-handled node. A long line buried inside an expression the
// dispatcher doesn't recognize stays long. That trade-off is preferable
// to corrupting unfamiliar shapes — extension over time turns each
// verbatim hop into a real reflow.

// PrintContext bundles the per-file inputs every per-node printer
// needs. The dispatcher constructs one per top-level reflow and threads
// it into every recursive call.
type PrintContext struct {
  File   *shimast.SourceFile
  Source string
  Opts   PrintOptions
}

// NewPrintContext returns a context wired to `file` and `opts`. The
// helper exists so call sites do not have to remember to read
// `file.Text()` and Opts defaults at every level.
func NewPrintContext(file *shimast.SourceFile, opts PrintOptions) *PrintContext {
  if opts.PrintWidth == 0 {
    opts = DefaultPrintOptions()
  }
  return &PrintContext{File: file, Source: file.Text(), Opts: opts}
}

// PrintNode is the dispatcher entry. It picks a per-node printer based
// on `node.Kind` and falls back to the verbatim source slice when no
// printer is registered. Returns the printed Doc and a boolean
// indicating whether the dispatch actually reformatted the node. The
// boolean is currently only used by the format/print-width rule, which
// skips edit emission when every printable child fell back to
// verbatim (no behavior change, no diagnostic).
func PrintNode(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, false
  }
  if doc, reformatted, ok := dispatchNode(ctx, node); ok {
    return doc, reformatted
  }
  return verbatim(ctx, node), false
}

// dispatchNode is the per-kind switch. Each branch returns
// (doc, reformatted, true) when it produces a structured Doc, or
// (zero, false, false) to let the caller fall back to verbatim. The
// reformatted flag is true when the per-node printer asserts the
// result may differ from the original bytes.
func dispatchNode(ctx *PrintContext, node *shimast.Node) (Doc, bool, bool) {
  switch node.Kind {
  case shimast.KindObjectLiteralExpression:
    return printObjectLiteral(ctx, node), true, true
  case shimast.KindArrayLiteralExpression:
    return printArrayLiteral(ctx, node), true, true
  case shimast.KindCallExpression:
    return printCallExpression(ctx, node), true, true
  case shimast.KindNewExpression:
    return printNewExpression(ctx, node), true, true
  case shimast.KindNamedImports:
    return printNamedImports(ctx, node), true, true
  case shimast.KindNamedExports:
    return printNamedExports(ctx, node), true, true
  case shimast.KindImportDeclaration:
    return printImportDeclaration(ctx, node), true, true
  }
  return Doc{}, false, false
}

// verbatim returns the original source bytes for `node`, leading trivia
// trimmed. Use this whenever a printer cannot fully cover a node — the
// surrounding doc tree still flows, but the verbatim slice carries
// whatever the user wrote, including comments and embedded line breaks.
func verbatim(ctx *PrintContext, node *shimast.Node) Doc {
  if node == nil {
    return Doc{}
  }
  start := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  end := node.End()
  if start < 0 || end < start || end > len(ctx.Source) {
    return Doc{}
  }
  return Text(ctx.Source[start:end])
}

// verbatimRange is the position-only sibling of verbatim — useful when
// the printer needs to copy a sub-range that does not correspond to a
// single AST node (e.g. tokens between two siblings).
func verbatimRange(src string, start, end int) Doc {
  if start < 0 || end < start || end > len(src) {
    return Doc{}
  }
  return Text(src[start:end])
}

// indentUnit returns one indentation step's worth of columns. Each
// per-node printer uses this for its own list nesting.
func (ctx *PrintContext) indentUnit() int {
  if ctx.Opts.TabWidth > 0 {
    return ctx.Opts.TabWidth
  }
  return 2
}
