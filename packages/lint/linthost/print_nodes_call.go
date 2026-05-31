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
  // A test-framework call (`test("desc", () => { … })`) hugs its callback even
  // when the description string pushes the opening line past printWidth, so the
  // exploded fallback is dropped for it. See isTestCall.
  argDoc, argCovered := printArgList(ctx, call.Arguments, addComma, decoratorCall, isTestCall(node))
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
    argDoc, argCovered := printArgList(ctx, ne.Arguments, ctx.allowsCallArgumentTrailingComma(), false, false)
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
func printArgList(ctx *PrintContext, list *shimast.NodeList, addComma bool, decoratorCall bool, forceHugLast bool) (Doc, bool) {
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
  // Two or more function/arrow arguments force the list to explode, one per
  // line, even when it would fit flat: Prettier always breaks a call carrying
  // multiple callbacks (`promise.then(() => a, () => b)`), the
  // function-composition rule. The sole exception is a decorator hugging a
  // huggable trailing argument (`@OneToMany(() => P, (p) => p.c, { … })`),
  // where the leading arrows stay inline and only the object breaks — so the
  // gate defers to hugLast off a decorator. See argListForcesFunctionBreak.
  forceFnBreak := argListForcesFunctionBreak(list.Nodes, decoratorCall)
  if forceFnBreak {
    hugLast = false
  }
  // A test-framework call always hugs its trailing callback (the description
  // string may overflow the open line); force the hug and drop the exploded
  // fallback via HugLastForce.
  if forceHugLast {
    hugLast = true
    forceFnBreak = false
  }
  shape := listShape{
    OpenTok:      "(",
    CloseTok:     ")",
    Items:        items,
    Space:        false,
    AddComma:     addComma,
    HugLast:      hugLast,
    HugLastForce: forceHugLast,
    HugFirst:     !hugLast && !forceFnBreak && shouldHugFirstArgument(ctx, list.Nodes),
    ForceBreak:   forceFnBreak,
    BlankBefore:  blankBeforeItems(ctx.Source, list.Nodes),
  }
  return printList(ctx, shape), covered
}

// testCalleeName reports whether `callee` names a test-framework function
// Prettier hugs: a bare identifier (`it`, `test`, `describe`, with the
// `f`/`x` focus/skip prefixes and `skip`), or a `.only` / `.skip` / `.step`
// member chain on one of those (`test.only`, `it.skip`). Mirrors Prettier's
// isTestCallCallee.
func testCalleeName(callee *shimast.Node) bool {
  if callee == nil {
    return false
  }
  switch callee.Kind {
  case shimast.KindIdentifier:
    switch identifierText(callee) {
    case "it", "fit", "xit",
      "describe", "fdescribe", "xdescribe",
      "test", "ftest", "xtest",
      "skip":
      return true
    }
  case shimast.KindPropertyAccessExpression:
    if pa := callee.AsPropertyAccessExpression(); pa != nil && pa.Name() != nil {
      switch identifierText(pa.Name()) {
      case "only", "skip", "step", "each", "todo", "failing", "concurrent":
        return testCalleeName(pa.Expression)
      }
    }
  }
  return false
}

// isTestCall reports whether `node` is a test-framework call Prettier prints
// with its callback hugged regardless of width: `it(...)` / `test(...)` /
// `describe(...)` (and focus/skip variants) called with a string or template
// description and a trailing function/arrow. Prettier never explodes such a
// call's arguments, so the printer keeps the callback on the open-paren line
// even when the description string overflows printWidth (the callback's
// parameter count does not matter, verified against Prettier). Scoped to the
// two-argument form (the overwhelming shape); a three-argument timeout variant
// falls through to ordinary hugging.
func isTestCall(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call == nil || call.QuestionDotToken != nil || call.Arguments == nil {
    return false
  }
  args := call.Arguments.Nodes
  if len(args) != 2 || args[0] == nil || args[1] == nil {
    return false
  }
  switch args[0].Kind {
  case shimast.KindStringLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateExpression:
  default:
    return false
  }
  if !isFunctionLikeArg(args[1]) {
    return false
  }
  return testCalleeName(call.Expression)
}

// isFunctionLikeArg reports whether an argument is a function or arrow
// expression, the two shapes Prettier counts as "function" arguments.
func isFunctionLikeArg(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindArrowFunction, shimast.KindFunctionExpression:
    return true
  }
  return false
}

// callArgsContainFunctionLike reports whether a call- or new-expression's own
// argument list carries a function/arrow argument. Prettier's
// function-composition test treats `foo.map((x) => x)` as a composed call, so
// a call carrying it alongside any second argument explodes.
func callArgsContainFunctionLike(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  var args *shimast.NodeList
  switch node.Kind {
  case shimast.KindCallExpression:
    if c := node.AsCallExpression(); c != nil {
      args = c.Arguments
    }
  case shimast.KindNewExpression:
    if n := node.AsNewExpression(); n != nil {
      args = n.Arguments
    }
  default:
    return false
  }
  if args == nil {
    return false
  }
  for _, a := range args.Nodes {
    if isFunctionLikeArg(a) {
      return true
    }
  }
  return false
}

// isFunctionCompositionArgs mirrors Prettier's predicate of the same name: a
// call with two or more arguments is "function composition" when either two of
// them are themselves functions/arrows, or one is a call/new whose own
// arguments include a function/arrow (`stream.pipe(map((x) => x), other)`).
// Prettier breaks such a list onto one-argument-per-line unconditionally.
func isFunctionCompositionArgs(args []*shimast.Node) bool {
  if len(args) <= 1 {
    return false
  }
  fnCount := 0
  for _, a := range args {
    if isFunctionLikeArg(a) {
      fnCount++
      if fnCount > 1 {
        return true
      }
    } else if callArgsContainFunctionLike(a) {
      return true
    }
  }
  return false
}

// argListForcesFunctionBreak reports whether a call's argument list must
// explode under Prettier's function-composition rule (see
// isFunctionCompositionArgs), which fires even when the call would fit on one
// line. A decorator hugging a huggable trailing argument is the one shape that
// keeps the leading callbacks inline (`@OneToMany(() => P, (p) => p.c, { … })`
// breaks only the object), so it is exempt; everywhere else the composed
// arguments break. Shared by printArgList (which sets ForceBreak) and the
// print-width rule (whose fit fast-path must not skip such a call when it is
// written flat in source).
func argListForcesFunctionBreak(args []*shimast.Node, decoratorCall bool) bool {
  if !isFunctionCompositionArgs(args) {
    return false
  }
  if decoratorCall && shouldHugLastArgument(args) {
    return false
  }
  return true
}

// callForcesFunctionBreak reports whether a node is a CallExpression that the
// multiple-callback rule forces to explode. The print-width rule consults it
// so its flat-fit fast path does not leave such a call inline when the source
// wrote it on one line.
func callForcesFunctionBreak(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call == nil || call.Arguments == nil {
    return false
  }
  decoratorCall := node.Parent != nil && node.Parent.Kind == shimast.KindDecorator
  return argListForcesFunctionBreak(call.Arguments.Nodes, decoratorCall)
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
    case shimast.KindBlock:
      // A block-bodied arrow hugs regardless of any return-type annotation.
      return true
    case shimast.KindObjectLiteralExpression,
      shimast.KindArrayLiteralExpression:
      // An expression-bodied arrow with an explicit return type is not hugged:
      // Prettier's couldGroupArg excludes it ("avoid breaking inside composite
      // return types"), so `map((r): T => ({ … }))` explodes the whole list
      // while `map((r) => ({ … }))` hugs.
      return arrow.Type == nil
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
// idiom. It also accepts an empty object literal, a short call/new, and a
// short arithmetic/logical expression (`setTimeout(fn, 1000 - x)`). A function,
// arrow, conditional, or a non-empty object literal is excluded so
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
  case shimast.KindObjectLiteralExpression:
    // `reduce(fn, {})`: an EMPTY object literal hugs (Prettier's couldGroupArg
    // excludes a property-less object); an object with properties expands and
    // explodes the list instead (`f(fn, { a: 1 })`).
    if obj := node.AsObjectLiteralExpression(); obj != nil {
      return obj.Properties == nil || len(obj.Properties.Nodes) == 0
    }
  case shimast.KindBinaryExpression, shimast.KindPrefixUnaryExpression:
    // `setTimeout(fn, 1000 - ellapsed)` / `new RunOnceScheduler(fn, 30 * 1000)`:
    // a short single-line arithmetic or logical expression rides the close
    // line. Bound it by source span like the call case — a long binary whose
    // hugged close line would overflow falls through to the exploded list, as
    // Prettier's render does.
    return shortSingleLineSpan(ctx.Source, node, 40)
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
