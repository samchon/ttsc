package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
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
    parts = append(parts, verbatimRange(ctx.Source, typeArgsStart(ctx.Source, call.TypeArguments), typeArgsEnd(ctx.Source, call.TypeArguments)))
  }
  if hasNilEntry(call.Arguments) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  // Prettier never appends a trailing comma inside a dynamic
  // `import(...)`, so the printer's reflow must agree with
  // format/trailing-comma's same exception (see isDynamicImportCall).
  addComma := ctx.allowsCallArgumentTrailingComma() && !isDynamicImportCall(call)
  // A decorator's call hugs its last argument even past leading callbacks
  // (`@OneToMany(() => P, (p) => p.c, { … })`); a plain call explodes there.
  decoratorCall := node.Parent != nil && node.Parent.Kind == shimast.KindDecorator
  argDoc, argCovered := printArgList(ctx, call.Arguments, addComma, decoratorCall)
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
    parts = append(parts, verbatimRange(ctx.Source, typeArgsStart(ctx.Source, ne.TypeArguments), typeArgsEnd(ctx.Source, ne.TypeArguments)))
  }
  if ne.Arguments != nil {
    if hasNilEntry(ne.Arguments) {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    argDoc, argCovered := printArgList(ctx, ne.Arguments, ctx.allowsCallArgumentTrailingComma(), false)
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
// `addComma` is supplied by the caller (which honors `format.trailingComma`
// and the dynamic-import exception) rather than read here, so call and new
// expressions can diverge on the comma without printArgList knowing the
// callee. Call / new argument lists accepted trailing commas only in
// ES2017+, so Prettier's "es5" and "none" modes pass false; otherwise the
// printer would oscillate against format/trailing-comma on every cascade
// pass (rxjs hit this on ajax.ts and several operators / testing helpers).
func printArgList(ctx *PrintContext, list *shimast.NodeList, addComma bool, decoratorCall bool) (Doc, bool) {
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
  // Last-argument hugging wins when both predicates match; first-arg
  // hugging only applies to the two-argument `callback, simpleArg` shape.
  // Decline last-arg hugging when a leading argument forces the call
  // multi-line on its own, so Prettier explodes the whole call rather than
  // hugging the last argument. Two leading shapes trigger that: a function
  // or arrow expression (`useMemo(() => x, [deps])`, even with an inline
  // expression body Prettier never hugs after it), and any argument whose
  // doc carries hard breaks (a block-bodied callback). A leading object or
  // array that merely fits flat does NOT decline — Prettier still hugs the
  // last argument there (`doConfigure({ … }, () => { … })`).
  // A decorator's call hugs its last argument even past leading callbacks
  // (`@OneToMany(() => P, (p) => p.c, { … })` keeps the arrows inline and
  // breaks only the object); a plain call with two or more leading callbacks
  // explodes instead, so the function-arg gate applies only off a decorator.
  hugLast := shouldHugLastArgument(list.Nodes) &&
    !anyLeadingItemBreaks(items) &&
    (decoratorCall || !anyLeadingArgIsFunctionLike(list.Nodes))
  shape := listShape{
    OpenTok:     "(",
    CloseTok:    ")",
    Items:       items,
    Space:       false,
    AddComma:    addComma,
    HugLast:     hugLast,
    HugFirst:    !hugLast && shouldHugFirstArgument(ctx, list.Nodes),
    BlankBefore: blankBeforeItems(ctx.Source, list.Nodes),
  }
  return printList(ctx, shape), covered
}

// anyLeadingArgIsFunctionLike reports whether any argument before the last
// is a function or arrow expression. Prettier declines last-argument
// hugging when a non-last argument is itself a function/arrow, regardless
// of its body, so `useMemo(() => compute(), [deps])` explodes rather than
// hugging the trailing array. This complements anyLeadingItemBreaks, which
// only catches leads with hard line breaks (a block body) and so misses an
// expression-bodied arrow.
func anyLeadingArgIsFunctionLike(args []*shimast.Node) bool {
  for i := 0; i+1 < len(args); i++ {
    if args[i] == nil {
      continue
    }
    switch args[i].Kind {
    case shimast.KindArrowFunction, shimast.KindFunctionExpression:
      return true
    }
  }
  return false
}

// anyLeadingItemBreaks reports whether any item before the last carries a
// hard line break — it cannot render flat. Such an item (a block-bodied
// callback) forces the call multi-line on its own, so last-argument
// hugging must decline and let the whole list explode, matching Prettier's
// willBreak gate on the non-last arguments.
func anyLeadingItemBreaks(items []Doc) bool {
  for i := 0; i+1 < len(items); i++ {
    if _, ok := flatten(items[i]); !ok {
      return true
    }
  }
  return false
}

// shouldHugLastArgument reports whether the final entry of `args` is a
// shape Prettier keeps hugging the closing paren: an object or array
// literal, a function expression, or an arrow function whose body is a
// block, an object literal, or an array literal. Hugging only applies
// when that argument is genuinely the last one; a callback in the
// middle of the list does not trigger the shape.
//
// An arrow with any other expression body (`(x) => x.id`) is
// deliberately excluded. Such a body carries no internal break point,
// so the hugging shape — a flat `Concat` with no Group — would pin the
// whole call to one line even when that line overflows printWidth.
// Routing it through the normal list shape instead lets the argument
// list explode onto its own line when the call does not fit, which is
// what Prettier does.
func shouldHugLastArgument(args []*shimast.Node) bool {
  if len(args) == 0 {
    return false
  }
  last := args[len(args)-1]
  if last == nil || !lastArgHuggableShape(last) {
    return false
  }
  // Prettier's shouldGroupLastArg declines only when the penultimate argument
  // is the SAME node kind as the last: two objects or two arrays compete for
  // the break, so `new Sash(x, { … }, { … })` and `bar({ … }, { … })` explode.
  // A different-kind penultimate (an arrow before an object, `@OneToMany(() =>
  // P, (p) => p.c, { … })`, or a plain `foo(a, b, { … })`) still hugs.
  if len(args) >= 2 {
    if pen := args[len(args)-2]; pen != nil && pen.Kind == last.Kind {
      return false
    }
  }
  return true
}

// lastArgHuggableShape reports whether `node` is the shape Prettier keeps
// hugging the closing paren: an object/array literal, a function expression,
// or an arrow whose body is a block, object, or array. An expression-bodied
// arrow (`(x) => x.id`) is excluded: it has no internal break point, so the
// flat hugging Concat would pin an overflowing call to one line.
func lastArgHuggableShape(last *shimast.Node) bool {
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

// shouldHugFirstArgument reports whether a call's argument list takes
// Prettier's "first-argument hugging" shape: exactly two arguments where
// the first is a block-bodied callback and the second is a short, simple
// value. `foo(() => { … }, target)` keeps the callback attached to the
// open paren and flows `, target)` after its closing brace, instead of
// exploding both arguments onto their own lines.
//
// Mirrors Prettier's shouldGroupFirstArg: it declines when the second
// argument is itself a function, arrow, conditional, or any expandable
// shape, so `both(() => {}, () => {})` falls through to the exploded
// list rather than hugging.
func shouldHugFirstArgument(ctx *PrintContext, args []*shimast.Node) bool {
  if len(args) != 2 {
    return false
  }
  first, second := args[0], args[1]
  if first == nil || second == nil {
    return false
  }
  return isFirstArgHuggableCallback(first) && isSimpleTrailingArg(ctx, second)
}

// isFirstArgHuggableCallback reports whether `node` is the callback shape
// Prettier hugs in the first-argument position: a function expression or
// an arrow with a block body. An expression-bodied arrow is excluded
// because it carries no internal break point.
func isFirstArgHuggableCallback(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindFunctionExpression:
    return true
  case shimast.KindArrowFunction:
    arrow := node.AsArrowFunction()
    return arrow != nil && arrow.Body != nil && arrow.Body.Kind == shimast.KindBlock
  }
  return false
}

// isSimpleTrailingArg reports whether `node` is a value that may trail a
// hugged first-argument callback. Prettier hugs the leading callback when
// the trailing argument is an identifier, member access, literal, `this`,
// or an array literal — most notably the `useEffect(() => { … }, [deps])`
// idiom. An object literal, function, arrow, or conditional is excluded so
// first-argument hugging declines and the whole list explodes.
//
// A call expression is deliberately NOT included: the conditional-group
// fit check only measures an option's first line, so a hugged-first option
// whose trailing call overflows the closing line (`}, deeplyNested(…))`)
// would still be selected, where Prettier explodes. The array case shares
// that limitation in principle, but dependency arrays are short in
// practice, the same way the identifier/member cases already are.
func isSimpleTrailingArg(ctx *PrintContext, node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindIdentifier,
    shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword,
    shimast.KindThisKeyword,
    shimast.KindPropertyAccessExpression,
    shimast.KindElementAccessExpression,
    shimast.KindArrayLiteralExpression:
    return true
  case shimast.KindAsExpression:
    // `[] as string[]`: the `reduce(fn, [] as T[])` idiom. Hug when the cast
    // wraps a value that is itself a simple trailing arg (e.g. an array).
    if as := node.AsAsExpression(); as != nil && as.Expression != nil {
      return isSimpleTrailingArg(ctx, as.Expression)
    }
  case shimast.KindCallExpression, shimast.KindNewExpression:
    // `reduce(fn, Object.create(null))` / `reduce(fn, new Map())`: Prettier
    // hugs the first arg when the trailing call is short enough to ride the
    // close line (`}, Object.create(null))`). The conditional-group fit check
    // measures only an option's FIRST line, so a long trailing call would be
    // mis-hugged; bound it by a short single-line source span (a safe proxy
    // for "fits the close line at a typical indent"). A longer or multi-line
    // trailing call falls through and the whole list explodes, as Prettier
    // does.
    return shortSingleLineSpan(ctx.Source, node, 30)
  }
  return false
}

// shortSingleLineSpan reports whether `node`'s source spans a single line and
// is at most `max` bytes — a cheap proxy for "fits on the close line of a
// first-argument hug at a typical indentation".
func shortSingleLineSpan(src string, node *shimast.Node, max int) bool {
  start := shimscanner.SkipTrivia(src, node.Pos())
  end := node.End()
  if start < 0 || end <= start || end > len(src) || end-start > max {
    return false
  }
  for i := start; i < end; i++ {
    if src[i] == '\n' || src[i] == '\r' {
      return false
    }
  }
  return true
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
// the list's range, so we have to scan around it. Call and new
// expressions share these — only the field holding the list differs.

// typeArgsStart returns the byte offset of the `<` that opens a
// type-argument list. Returns -1 when absent.
func typeArgsStart(src string, list *shimast.NodeList) int {
  if list == nil || len(list.Nodes) == 0 || list.Nodes[0] == nil {
    return -1
  }
  // `<` is the byte immediately before the first type argument
  // (modulo whitespace).
  for i := list.Nodes[0].Pos() - 1; i >= 0; i-- {
    if src[i] == '<' {
      return i
    }
  }
  return -1
}

// typeArgsEnd returns the byte offset one past the closing `>` of a
// type-argument list. Returns -1 when the list is absent.
func typeArgsEnd(src string, list *shimast.NodeList) int {
  if list == nil {
    return -1
  }
  end := list.End()
  for i := end; i < len(src); i++ {
    if src[i] == '>' {
      return i + 1
    }
  }
  return end
}
