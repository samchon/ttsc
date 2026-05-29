package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// AST → Doc dispatcher.
//
// The dispatcher is the bridge between the TypeScript-Go AST and the
// printer engine. It walks one node at a time and emits a Doc tree
// shaped to that node's grammar. Coverage is intentionally partial;
// the verbatim fallback below guarantees that an un-handled node kind
// contributes its original source bytes verbatim, so the printer can
// be wired up to a rule without breaking files that happen to use
// shapes the per-node printers don't yet understand.
//
// The price of verbatim fallback is that reflow stops at the boundary
// of an un-handled node. A long line buried inside an expression the
// dispatcher doesn't recognize stays long. That trade-off is preferable
// to corrupting unfamiliar shapes — extension over time turns each
// verbatim hop into a real reflow.
//
// Coverage signal. A verbatim slice keeps its *original* source column.
// When an un-handled node spans multiple lines, its interior lines are
// frozen at the columns the user wrote while the enclosing reflow
// re-indents everything around it — the result is inconsistently
// indented, corrupt output. To prevent that, every printer reports a
// `covered` boolean alongside its Doc: `true` means the whole printed
// subtree is reflow-safe (no multi-line verbatim node), `false` means a
// multi-line verbatim node is buried inside. The formatPrintWidth
// rule abstains entirely when `covered` is false, so `ttsc format`
// either reflows correctly or leaves the bytes untouched — it never
// emits the half-reflowed shape. Single-line verbatim is always safe:
// a node confined to one source line has no interior column to freeze.

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
// printer is registered. Returns the printed Doc and a `covered`
// boolean: `true` when the whole printed subtree is reflow-safe,
// `false` when a multi-line verbatim node is buried inside it.
//
// The formatPrintWidth rule consults `covered` to decide whether to
// emit an edit at all — see the coverage-signal note at the top of this
// file. A `false` reading is a hard abstain, not a soft hint.
func PrintNode(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  if doc, covered, ok := dispatchNode(ctx, node); ok {
    return doc, covered
  }
  return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
}

// dispatchNode is the per-kind switch. Each branch returns
// (doc, covered, true) when it produces a structured Doc, or
// (zero, false, false) to let the caller fall back to verbatim. The
// `covered` flag is `true` only when the per-node printer guarantees
// the whole subtree it produced is free of multi-line verbatim slices.
func dispatchNode(ctx *PrintContext, node *shimast.Node) (Doc, bool, bool) {
  switch node.Kind {
  case shimast.KindObjectLiteralExpression:
    doc, covered := printObjectLiteral(ctx, node)
    return doc, covered, true
  case shimast.KindArrayLiteralExpression:
    doc, covered := printArrayLiteral(ctx, node)
    return doc, covered, true
  case shimast.KindCallExpression:
    doc, covered := printCallExpression(ctx, node)
    return doc, covered, true
  case shimast.KindNewExpression:
    doc, covered := printNewExpression(ctx, node)
    return doc, covered, true
  case shimast.KindNamedImports:
    doc, covered := printNamedImports(ctx, node)
    return doc, covered, true
  case shimast.KindNamedExports:
    doc, covered := printNamedExports(ctx, node)
    return doc, covered, true
  case shimast.KindImportDeclaration:
    doc, covered := printImportDeclaration(ctx, node)
    return doc, covered, true
  case shimast.KindArrowFunction:
    doc, covered := printArrowFunction(ctx, node)
    return doc, covered, true
  case shimast.KindFunctionExpression:
    doc, covered := printFunctionExpression(ctx, node)
    return doc, covered, true
  case shimast.KindParenthesizedExpression:
    doc, covered := printParenthesizedExpression(ctx, node)
    return doc, covered, true
  case shimast.KindBlock:
    doc, covered := printBlock(ctx, node)
    return doc, covered, true
  case shimast.KindExpressionStatement:
    doc, covered := printExpressionStatement(ctx, node)
    return doc, covered, true
  case shimast.KindReturnStatement:
    doc, covered := printReturnStatement(ctx, node)
    return doc, covered, true
  case shimast.KindConditionalExpression:
    doc, covered := printConditionalExpression(ctx, node)
    return doc, covered, true
  }
  return Doc{}, false, false
}

// nodeSpansMultipleLines reports whether `node`'s trivia-trimmed source
// range crosses a newline. A verbatim slice that stays on one line is
// always reflow-safe — there is no interior column for the enclosing
// re-indent to leave stranded — so the dispatcher treats single-line
// verbatim as `covered`. A multi-line verbatim node freezes its
// interior columns and is reported uncovered.
func nodeSpansMultipleLines(ctx *PrintContext, node *shimast.Node) bool {
  if node == nil {
    return false
  }
  start := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  end := node.End()
  if start < 0 || end < start || end > len(ctx.Source) {
    return false
  }
  for i := start; i < end; i++ {
    if ctx.Source[i] == '\n' {
      return true
    }
  }
  return false
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

// verbatimRange returns a Text doc holding src[start:end] verbatim.
// It is the position-only sibling of verbatim: use it when the sub-range
// to copy does not correspond to a single AST node (e.g. `<T>` tokens
// that surround a type-argument NodeList).
func verbatimRange(src string, start, end int) Doc {
  if start < 0 || end < start || end > len(src) {
    return Doc{}
  }
  return Text(src[start:end])
}

// indentUnit returns the number of columns in one indentation step,
// derived from PrintOptions.TabWidth. Falls back to 2 when TabWidth
// is not set, matching the Prettier default.
func (ctx *PrintContext) indentUnit() int {
  if ctx.Opts.TabWidth > 0 {
    return ctx.Opts.TabWidth
  }
  return 2
}

// trailingCommaMode normalizes ctx.Opts.TrailingComma to one of "all",
// "es5", or "none". An empty value — the zero value for the field —
// reads as "all" to keep pre-existing callers and tests that built a
// PrintOptions{} without setting the field on Prettier's default
// behavior. Any other value also reads as "all"; the config layer
// rejects unknown strings before they reach the printer (see
// `expandFormatBlock` in config_format.go), so a stray value here is a
// programmer error and the safest fallback is the most-commas mode.
func (ctx *PrintContext) trailingCommaMode() string {
  switch ctx.Opts.TrailingComma {
  case "es5", "none":
    return ctx.Opts.TrailingComma
  }
  return "all"
}

// allowsCallArgumentTrailingComma reports whether a multi-line call /
// new argument list should emit a trailing comma under the current
// trailingComma setting. Trailing commas in call arguments arrived in
// ES2017, so Prettier's "es5" mode excludes them just like "none" does;
// only "all" keeps them. Parameter lists are not printed by the
// dispatcher today, but the same rule applies to them when they are.
func (ctx *PrintContext) allowsCallArgumentTrailingComma() bool {
  return ctx.trailingCommaMode() == "all"
}

// allowsEs5TrailingComma reports whether a multi-line ES5-permitted
// list — arrays, objects, named imports / exports — should emit a
// trailing comma. Only "none" suppresses the comma here; "es5" and
// "all" both keep it because ES5 has accepted trailing commas in these
// positions since the language's inception.
func (ctx *PrintContext) allowsEs5TrailingComma() bool {
  return ctx.trailingCommaMode() != "none"
}
