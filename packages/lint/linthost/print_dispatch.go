package linthost

import (
  "strings"

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

// PrintContext bundles the source and options consumed by per-node printers.
// The caller constructs it for a top-level reflow and passes it through
// recursive dispatch. Its public fields are writable; keep File, Source and
// Opts consistent and unchanged during that reflow.
//
// @evidence contracts/common.md#principled-implementation The source file, its exact text and resolved layout options keep recursive printers in one byte-coordinate and formatting context.
// @evidence contracts/common.md#clear-and-simple-design One context groups stable per-file inputs instead of resolving policy in every node printer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Printers receive actual source and options rather than expected-output fragments or modified foreign AST methods.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies per-file scope and members describe source ownership and layout options; member gaps and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation PrintContext is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms PrintContext is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work PrintContext is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources PrintContext is a declaration of data shape; the code that holds its values owns their lifetime.
type PrintContext struct {
  // File is the borrowed compiler source file; do not mutate it during reflow.
  File   *shimast.SourceFile

  // Source is the same file's original text, using compiler byte positions.
  Source string

  // Opts controls layout decisions throughout this reflow.
  Opts   PrintOptions
}

// NewPrintContext returns a context wired to `file` and `opts`. The
// helper exists so call sites do not have to remember to read
// `file.Text()` and Opts defaults at every level.
//
// The file must be nonnil. A zero PrintWidth selects the complete default option set.
//
// @evidence contracts/common.md#principled-implementation The nonnil source file supplies exact text and zero-width callers receive the documented complete defaults.
// @evidence contracts/common.md#clear-and-simple-design One constructor establishes the recursive print inputs and default selection once.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Defaults are the public formatting policy rather than fixture-specific widths or source substitutions.
// @evidence contracts/common.md#meaningful-documentation Native prose states the nonnil premise and whole-default behavior; separated tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewPrintContext performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewPrintContext has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Construction establishes caller-owned reflow inputs, not a request-result coordinator. Source state and options determine valid rendering, and public fields remain mutable; retaining or sharing this context across reflows requires the caller to preserve that identity and consistency.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned context keeps the borrowed SourceFile and its original text storage reachable without copying source bytes. Its caller owns context lifetime and reflow consistency, while the compiler/host owns source state. No historical context cache, handle or running task is created.
func NewPrintContext(file *shimast.SourceFile, opts PrintOptions) *PrintContext {
  if opts.PrintWidth == 0 {
    opts = DefaultPrintOptions()
  }
  return &PrintContext{File: file, Source: file.Text(), Opts: opts}
}

// PrintNode is the dispatcher entry. It picks a per-node printer based
// on `node.Kind` and falls back to the leading-trivia-trimmed source slice when no
// printer is registered. Returns the printed Doc and a `covered`
// boolean: `true` when the whole printed subtree is reflow-safe,
// `false` when a multi-line verbatim node is buried inside it.
//
// The formatPrintWidth rule consults `covered` to decide whether to
// emit an edit at all; see the coverage-signal note at the top of this
// file. A `false` reading is a hard abstain, not a soft hint.
//
// A nonnil node requires a nonnil context for that node's source file. A nil
// node contributes an empty Doc and is covered.
//
// @evidence contracts/common.md#principled-implementation Supported node printers return a layout plus coverage; unsupported nodes retain their trivia-trimmed source slice and classify its multiline boundary. The selected printer owns recursive coverage propagation.
// @evidence contracts/common.md#clear-and-simple-design One dispatcher owns grammar selection and one fallback retains unknown syntax without duplicating per-node policies.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Verbatim fallback is the supported partial-printer boundary, not an invented replacement for unknown grammar; the false coverage signal prevents applying an incomplete rewrite.
// @evidence contracts/common.md#meaningful-documentation Native prose explains partial grammar coverage, byte-preserving fallback and abstention; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation PrintNode performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper selects a grammar branch but delegates the subtree algorithm, scans and Doc allocation to its printer. Fallback scans leading trivia twice and checks the remaining node slice for newlines; that cost grows with trivia and range bytes, so a loop-free wrapper does not certify fixed total work.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Dispatch owns no cross-request cache or coordinator. Context source/options and mutable AST/backing-storage identity determine valid Doc/coverage reuse; the caller establishes equivalence rather than this wrapper memoizing by node pointer.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned Doc may own printer-created child slices and keep original source string backing storage reachable through verbatim substrings. The caller owns resulting tree lifetime and printing immutability; selected printers establish child storage sharing. Dispatch keeps no historical Doc cache, handle or running task.
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
  case shimast.KindPropertyAssignment,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor:
    doc, covered := printObjectMember(ctx, node)
    return doc, covered, true
  case shimast.KindForStatement,
    shimast.KindForOfStatement,
    shimast.KindForInStatement,
    shimast.KindWhileStatement,
    shimast.KindIfStatement,
    shimast.KindTryStatement,
    shimast.KindSwitchStatement:
    doc, covered := printControlFlowStatement(ctx, node)
    return doc, covered, true
  case shimast.KindCaseBlock:
    doc, covered := printSwitchCaseBlock(ctx, node)
    return doc, covered, true
  case shimast.KindVariableStatement:
    doc, covered := printVariableStatement(ctx, node)
    return doc, covered, true
  case shimast.KindThrowStatement:
    doc, covered := printThrowStatement(ctx, node)
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
  if node == nil || ctx == nil || node.Pos() < 0 || node.Pos() > len(ctx.Source) {
    return false
  }
  start := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  end := node.End()
  if start < 0 || end < start || end > len(ctx.Source) {
    return false
  }
  return strings.ContainsAny(ctx.Source[start:end], "\r\n\u2028\u2029")
}

// verbatim returns the original source bytes for `node`, leading trivia
// trimmed. Use this whenever a printer cannot fully cover a node — the
// surrounding doc tree still flows, but the verbatim slice carries
// whatever the user wrote, including comments and embedded line breaks.
func verbatim(ctx *PrintContext, node *shimast.Node) Doc {
  if node == nil || ctx == nil || node.Pos() < 0 || node.Pos() > len(ctx.Source) {
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
