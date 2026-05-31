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

// testCalleePatterns is Prettier's exact testCallCalleePatterns set (the dotted
// callee chains its isTestCallCallee matches). Matching the precise set, rather
// than "any base with a {only,skip,…} tail", avoids both over-matching
// (`test.each`, `it.todo` are NOT test calls) and under-matching (`test.fixme`,
// `test.describe.only` ARE).
var testCalleePatterns = map[string]bool{
  "it": true, "it.only": true, "it.skip": true,
  "describe": true, "describe.only": true, "describe.skip": true,
  "test": true, "test.only": true, "test.skip": true,
  "test.fixme": true, "test.step": true,
  "test.describe": true, "test.describe.only": true,
  "test.describe.skip": true, "test.describe.fixme": true,
  "test.describe.parallel": true, "test.describe.parallel.only": true,
  "test.describe.serial": true, "test.describe.serial.only": true,
  "skip": true, "xit": true, "xdescribe": true, "xtest": true,
  "fit": true, "fdescribe": true, "ftest": true,
}

// calleeChain builds the dotted member-access chain of a callee rooted at a
// plain identifier (`test.describe.only` becomes "test.describe.only"), or ""
// when the callee is not a pure identifier / property-access chain (a computed
// access, a call, `this`, etc.).
func calleeChain(node *shimast.Node) string {
  switch node.Kind {
  case shimast.KindIdentifier:
    return identifierText(node)
  case shimast.KindPropertyAccessExpression:
    pa := node.AsPropertyAccessExpression()
    if pa == nil || pa.Name() == nil || pa.Name().Kind != shimast.KindIdentifier {
      return ""
    }
    base := calleeChain(pa.Expression)
    if base == "" {
      return ""
    }
    return base + "." + identifierText(pa.Name())
  }
  return ""
}

// testCalleeName reports whether `callee` is one of Prettier's recognized
// test-framework callees (see testCalleePatterns).
func testCalleeName(callee *shimast.Node) bool {
  return callee != nil && testCalleePatterns[calleeChain(callee)]
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
  // Prettier accepts a two- or three-argument test call (the third is a numeric
  // timeout): `it("name", () => { … })` and `it("name", () => { … }, 2500)`.
  if len(args) != 2 && len(args) != 3 {
    return false
  }
  if args[0] == nil || args[1] == nil {
    return false
  }
  switch args[0].Kind {
  case shimast.KindStringLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateExpression:
  default:
    return false
  }
  if !testCalleeName(call.Expression) {
    return false
  }
  if len(args) == 3 {
    // The timeout argument must be numeric, and the callback a block-bodied
    // function/arrow taking at most one parameter (Prettier's
    // isFunctionOrArrowExpressionWithBody + parameter-count gate).
    if args[2] == nil || args[2].Kind != shimast.KindNumericLiteral {
      return false
    }
    return isBlockBodiedCallback(args[1]) && len(args[1].Parameters()) <= 1
  }
  return isFunctionLikeArg(args[1])
}

// isBlockBodiedCallback reports whether a node is a function expression or an
// arrow with a block body (Prettier's isFunctionOrArrowExpressionWithBody).
func isBlockBodiedCallback(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindFunctionExpression:
    return true
  case shimast.KindArrowFunction:
    a := node.AsArrowFunction()
    return a != nil && a.Body != nil && a.Body.Kind == shimast.KindBlock
  }
  return false
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

// callArgsContainFunctionLike reports whether a CALL expression's own argument
// list carries a function/arrow argument. Prettier's function-composition test
// treats `foo.map((x) => x)` as a composed call, so a call carrying it
// alongside any second argument explodes. Only a call counts: Prettier's
// isCallExpression matches CallExpression / OptionalCallExpression but NOT a
// NewExpression, so `foo(new Bar(() => x), other)` is left inline.
func callArgsContainFunctionLike(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  c := node.AsCallExpression()
  if c == nil || c.Arguments == nil {
    return false
  }
  for _, a := range c.Arguments.Nodes {
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
// line. A DECORATOR is exempt entirely: Prettier guards the rule with
// `path.parent.type !== "Decorator"` (printCallArguments in call-arguments.js),
// so `@ManyToOne(() => User, (u) => u.addresses)` stays flat when it fits and
// breaks only on width. Shared by printArgList (which sets ForceBreak) and the
// print-width rule (whose fit fast-path must not skip such a call when it is
// written flat in source).
func argListForcesFunctionBreak(args []*shimast.Node, decoratorCall bool) bool {
  if decoratorCall {
    return false
  }
  return isFunctionCompositionArgs(args)
}

// callForcesFunctionBreak reports whether a node is a call OR new expression
// that the multiple-callback rule forces to explode. Prettier's printCallArguments
// is shared by NewExpression (its function-composition break is gated only by
// `path.parent.type !== "Decorator"`, not by call-vs-new), so `new Foo(() => a,
// () => b)` explodes the same as a call. The print-width rule consults this so
// its flat-fit fast path does not leave such a call/new inline when the source
// wrote it on one line.
func callForcesFunctionBreak(node *shimast.Node) bool {
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
  // A new expression is never a decorator's call.
  decoratorCall := node.Kind == shimast.KindCallExpression &&
    node.Parent != nil && node.Parent.Kind == shimast.KindDecorator
  return argListForcesFunctionBreak(args.Nodes, decoratorCall)
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
    // Prettier's shouldExpandLastArg also declines a CONCISELY-PRINTED numeric
    // array as the last of two-plus arguments: it fills on its own line, so
    // `drawPolygon(ctx, [1, 2, 3, …])` explodes rather than hugging.
    if last.Kind == shimast.KindArrayLiteralExpression {
      if arr := last.AsArrayLiteralExpression(); arr != nil && arr.Elements != nil &&
        isConciselyPrintedArray(arr.Elements.Nodes) {
        return false
      }
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
  case shimast.KindFunctionExpression:
    return true
  case shimast.KindObjectLiteralExpression:
    // Prettier's couldExpandArg requires a NON-EMPTY object (`properties.length
    // > 0`); an empty `{}` is not expandable, so `foo(a, b, {})` explodes the
    // list rather than hugging. (Inter-item comments route to verbatim, so the
    // hasComment branch is moot here.)
    if obj := last.AsObjectLiteralExpression(); obj != nil {
      return obj.Properties != nil && len(obj.Properties.Nodes) > 0
    }
    return false
  case shimast.KindArrayLiteralExpression:
    // Likewise a non-empty array; an empty `[]` is not expandable.
    if arr := last.AsArrayLiteralExpression(); arr != nil {
      return arr.Elements != nil && len(arr.Elements.Nodes) > 0
    }
    return false
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
  if !isFirstArgHuggableCallback(first) {
    return false
  }
  // A NON-EMPTY array trailing arg hugs only in Prettier's React-hook deps
  // shape (isReactHookCallWithDepsArray): a ZERO-parameter arrow callback plus
  // an array, e.g. `useEffect(() => { … }, [a, b])`. With a parameter the call
  // explodes (`subscribe((event) => { … }, [a, b])`), and a function expression
  // (not an arrow) never qualifies. An EMPTY array falls through to
  // isSimpleTrailingArg.
  if second.Kind == shimast.KindArrayLiteralExpression {
    if arr := second.AsArrayLiteralExpression(); arr != nil &&
      arr.Elements != nil && len(arr.Elements.Nodes) > 0 {
      return first.Kind == shimast.KindArrowFunction && len(first.Parameters()) == 0
    }
  }
  return isSimpleTrailingArg(ctx, second)
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
// or an EMPTY array/object literal. It also accepts a short call/new (at
// most one value argument) and a short arithmetic/logical expression
// (`setTimeout(fn, 1000 - x)`). A function, arrow, conditional, a non-empty
// array, or a non-empty object literal is excluded, so first-argument hugging
// declines and the whole list explodes. (A non-empty array after a
// zero-parameter arrow is the React-hook deps shape, hugged earlier in
// shouldHugFirstArgument and never routed here.)
//
// The call/new case rides the close line: the conditional-group fit check
// only measures an option's first line, so a hugged-first option whose
// trailing call overflows the closing line is still selected. Prettier
// accepts the same trade for a short trailing call.
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
    shimast.KindElementAccessExpression:
    return true
  case shimast.KindArrayLiteralExpression:
    // Only an EMPTY array is simple-trailing (the `[] as T[]` cast idiom).
    // Prettier's couldExpandArg treats an array with elements as expandable,
    // so a non-empty array cast (`[x] as number[]`) explodes the list rather
    // than hugging. The non-empty bare-array deps shape (zero-param arrow) is
    // handled in shouldHugFirstArgument before reaching here.
    if arr := node.AsArrayLiteralExpression(); arr != nil {
      return arr.Elements == nil || len(arr.Elements.Nodes) == 0
    }
    return false
  case shimast.KindAsExpression:
    // `[] as string[]`: the `reduce(fn, [] as T[])` idiom. Hug when the cast
    // wraps a simple trailing arg AND the target is a simple type, mirroring
    // Prettier's isHopefullyShortCallArgument cast branch (see isSimpleCastType).
    if as := node.AsAsExpression(); as != nil && as.Expression != nil {
      return isSimpleTrailingArg(ctx, as.Expression) && isSimpleCastType(as.Type)
    }
  case shimast.KindCallExpression, shimast.KindNewExpression:
    // `reduce(fn, Object.create(null))` / `reduce(fn, new Map<…>())`: Prettier
    // hugs the first arg when the trailing call/new has at most one value
    // argument, regardless of its length, type arguments and long names do not
    // matter and the close line is allowed to overflow. A call with two or more
    // arguments explodes the whole list instead. Mirrors Prettier's
    // isHopefullyShortCallArgument for call-like nodes.
    return callValueArgCount(node) <= 1
  case shimast.KindObjectLiteralExpression:
    // `reduce(fn, {})`: an EMPTY object literal hugs (Prettier's couldGroupArg
    // excludes a property-less object); an object with properties expands and
    // explodes the list instead (`f(fn, { a: 1 })`).
    if obj := node.AsObjectLiteralExpression(); obj != nil {
      return obj.Properties == nil || len(obj.Properties.Nodes) == 0
    }
  case shimast.KindBinaryExpression:
    // `setTimeout(fn, 1000 - ellapsed)`: a SINGLE arithmetic/logical operation
    // whose two operands are simple leaves rides the close line and hugs. A
    // chained binary (`60 * 60 * 1000`, an operand itself a binary) is not
    // simple and explodes the list, matching Prettier's isHopefullyShortCallArgument
    // (which only treats a binaryish short when both sides are themselves short).
    if bin := node.AsBinaryExpression(); bin != nil {
      return isSimpleBinaryOperand(bin.Left) && isSimpleBinaryOperand(bin.Right)
    }
  case shimast.KindPrefixUnaryExpression:
    // `reduce(fn, -1)`: a unary applied to a simple leaf rides the close line.
    if u := node.AsPrefixUnaryExpression(); u != nil {
      return isSimpleBinaryOperand(u.Operand)
    }
  }
  return false
}

// isSimpleBinaryOperand reports whether a node is a short, non-recursive
// operand, an identifier, a literal, `this`, or a member access. A binary,
// call, conditional, or other compound expression is not, so a binary built
// from such operands is treated as too complex to ride a hugged close line.
func isSimpleBinaryOperand(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindIdentifier,
    shimast.KindNumericLiteral,
    shimast.KindStringLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword,
    shimast.KindThisKeyword,
    shimast.KindPropertyAccessExpression,
    shimast.KindElementAccessExpression:
    return true
  }
  return false
}

// isSimpleCastType ports the type half of Prettier's isHopefullyShortCallArgument
// cast branch: unwrap an array type up to two levels (`T[]`, `T[][]` -> `T`) and
// a single-type-argument reference (`Ref<X>` -> `X`), then require a SIMPLE type
// (isSimpleTypeNode). A reference still carrying type arguments after the unwrap
// (`Foo<A, B>`, `Array<Array<string>>`), or a union / intersection / function /
// tuple / object type, is not simple, so the cast declines the first-argument
// hug and the list explodes, matching Prettier.
func isSimpleCastType(typeNode *shimast.Node) bool {
  node := typeNode
  for i := 0; i < 2 && node != nil && node.Kind == shimast.KindArrayType; i++ {
    at := node.AsArrayTypeNode()
    if at == nil || at.ElementType == nil {
      return false
    }
    node = at.ElementType
  }
  if node != nil && node.Kind == shimast.KindTypeReference {
    if ref := node.AsTypeReferenceNode(); ref != nil && ref.TypeArguments != nil &&
      len(ref.TypeArguments.Nodes) == 1 {
      node = ref.TypeArguments.Nodes[0]
    }
  }
  return isSimpleTypeNode(node)
}

// isSimpleTypeNode mirrors Prettier's isSimpleType: a keyword/primitive type, a
// literal type, `this`, or a bare type reference with NO type arguments.
func isSimpleTypeNode(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindStringKeyword, shimast.KindNumberKeyword, shimast.KindBooleanKeyword,
    shimast.KindAnyKeyword, shimast.KindUnknownKeyword, shimast.KindVoidKeyword,
    shimast.KindNeverKeyword, shimast.KindUndefinedKeyword, shimast.KindNullKeyword,
    shimast.KindObjectKeyword, shimast.KindSymbolKeyword, shimast.KindBigIntKeyword,
    shimast.KindThisType, shimast.KindLiteralType:
    return true
  case shimast.KindTypeReference:
    ref := node.AsTypeReferenceNode()
    return ref != nil && (ref.TypeArguments == nil || len(ref.TypeArguments.Nodes) == 0)
  }
  return false
}

// callValueArgCount returns the number of value arguments on a call or new
// expression (type arguments are not counted). A new expression with no
// argument list (`new Foo`) counts as zero.
func callValueArgCount(node *shimast.Node) int {
  switch node.Kind {
  case shimast.KindCallExpression:
    if c := node.AsCallExpression(); c != nil && c.Arguments != nil {
      return len(c.Arguments.Nodes)
    }
  case shimast.KindNewExpression:
    if n := node.AsNewExpression(); n != nil && n.Arguments != nil {
      return len(n.Arguments.Nodes)
    }
  }
  return 0
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
