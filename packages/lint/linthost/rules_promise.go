package linthost

import (
  "encoding/json"
  "path/filepath"
  "runtime"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

const promiseRulePrefix = "promise/"

// awaitThenable: `await x` where `x` is not a Promise and not a
// thenable is always a no-op. The runtime resolves `await 42` to `42`
// after one microtask hop — almost never the intent. typescript-eslint
// recommended-type-checked:
// https://typescript-eslint.io/rules/await-thenable/
//
// The upstream rule checks four `await`-related constructs, and this port
// mirrors all four:
//
//   - `await expr` — the operand must be a Promise or a thenable
//     (checkAwaitThenableExpression);
//   - `for await...of expr` — the source must expose the async-iterator
//     protocol (`[Symbol.asyncIterator]`), not merely the sync fallback
//     JavaScript permits (checkAwaitThenableForAwaitOf);
//   - `await using x = expr` — each initializer must expose the
//     async-dispose protocol (`[Symbol.asyncDispose]`), not only
//     `[Symbol.dispose]` (checkAwaitThenableAwaitUsing);
//   - `Promise.all` / `allSettled` / `any` / `race` — the resolved receiver
//     must be the native Promise constructor and iterable members must not be
//     statically always non-awaitable (checkAwaitThenablePromiseAggregator).
//
// This is the first rule in the corpus to consult `ctx.Checker`. The
// shim's `Checker` is a type alias for tsgo's `*innerchecker.Checker`,
// so every exported method (`GetTypeAtLocation`, `GetPromisedTypeOfPromise`,
// `GetPropertyOfType`, `GetSignaturesOfType`) is callable directly with
// no shim addition; the well-known-symbol lookups additionally go through
// the linknamed `Checker_getPropertyNameForKnownSymbolName`.
type awaitThenable struct{}

func (awaitThenable) Name() string { return "typescript/await-thenable" }
func (awaitThenable) NeedsTypeChecker() bool {
  return true
}
func (awaitThenable) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindAwaitExpression,
    shimast.KindCallExpression,
    shimast.KindForOfStatement,
    shimast.KindVariableDeclarationList,
  }
}
func (awaitThenable) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  switch node.Kind {
  case shimast.KindAwaitExpression:
    checkAwaitThenableExpression(ctx, node)
  case shimast.KindCallExpression:
    checkAwaitThenablePromiseAggregator(ctx, node)
  case shimast.KindForOfStatement:
    checkAwaitThenableForAwaitOf(ctx, node)
  case shimast.KindVariableDeclarationList:
    checkAwaitThenableAwaitUsing(ctx, node)
  }
}

// checkAwaitThenableExpression handles the ordinary `await expr` arm. The
// operand must be definitely non-awaitable before the rule reports. `any`,
// `unknown`, unconstrained type parameters, and unions with a thenable member
// remain clean because their awaitability is uncertain. The finding offers an
// opt-in suggestion that drops only the `await` token. It is not an autofix:
// even a non-thenable await creates an observable microtask boundary.
func checkAwaitThenableExpression(ctx *Context, node *shimast.Node) {
  expr := node.AsAwaitExpression()
  if expr == nil || expr.Expression == nil {
    return
  }
  operandType := ctx.Checker.GetTypeAtLocation(expr.Expression)
  if operandType == nil {
    return
  }
  if classifyPromiseAwaitability(ctx.Checker, expr.Expression, operandType) != promiseAwaitabilityNever {
    return
  }
  message := "Unexpected `await` of a non-Promise (non-\"Thenable\") value."
  // Match upstream's suggestion exactly: delete the keyword token while
  // preserving all trivia between it and the operand.
  startPos, _ := tokenRange(ctx.File, node)
  awaitEnd := startPos + len("await")
  if startPos < 0 || awaitEnd > expr.Expression.Pos() {
    ctx.Report(node, message)
    return
  }
  ctx.ReportSuggestion(
    node,
    message,
    "Remove unnecessary `await`.",
    TextEdit{Pos: startPos, End: awaitEnd, Text: ""},
  )
}

// checkAwaitThenablePromiseAggregator handles the native Promise collection
// methods. An array literal reports each always-non-awaitable member on that
// member; a typed array, tuple, or Iterable reports once on the argument when
// any possible element type is definitely non-awaitable. The paths
// deliberately differ for a `Promise<T> | T` element: a literal member may be
// awaitable at runtime, while a typed container includes a non-awaitable
// possibility.
func checkAwaitThenablePromiseAggregator(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  object, _, ok := promiseAggregatorCallParts(call)
  if !ok || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  objectType := ctx.Checker.GetTypeAtLocation(object)
  if !isNativePromiseConstructorLike(ctx.Checker, objectType) {
    return
  }

  argument := stripParens(call.Arguments.Nodes[0])
  if argument == nil {
    return
  }
  if argument.Kind == shimast.KindArrayLiteralExpression {
    array := argument.AsArrayLiteralExpression()
    if array == nil || array.Elements == nil {
      return
    }
    for _, element := range array.Elements.Nodes {
      if element == nil || element.Kind == shimast.KindOmittedExpression {
        continue
      }
      elementType := ctx.Checker.GetTypeAtLocation(element)
      if promiseTypePartsAllHaveAwaitability(ctx.Checker, element, elementType, promiseAwaitabilityNever) {
        reportInvalidPromiseAggregatorInput(ctx, element)
      }
    }
    return
  }

  argumentType := constrainedPromiseType(ctx.Checker, ctx.Checker.GetTypeAtLocation(argument))
  if !isIterablePromiseAggregatorInput(ctx.Checker, argument, argumentType) {
    return
  }
  for _, part := range promiseUnionParts(argumentType) {
    for _, elementType := range promiseIterableElementTypes(ctx.Checker, part) {
      if promiseTypePartsHaveAwaitability(ctx.Checker, argument, elementType, promiseAwaitabilityNever) {
        reportInvalidPromiseAggregatorInput(ctx, argument)
        return
      }
    }
  }
}

func reportInvalidPromiseAggregatorInput(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Unexpected iterable of non-Promise (non-\"Thenable\") values passed to promise aggregator.")
}

// checkAwaitThenableForAwaitOf handles the `for await...of` arm. Iterating a
// merely sync iterable with `for await` is legal JavaScript (the runtime
// falls back to the sync iterator and awaits each yielded value), but it has
// different iterator-closing/error semantics than a plain `for...of` and can
// obscure serial Promise consumption, so this port rejects any source
// whose type does not expose a callable `[Symbol.asyncIterator]`. `any`
// escapes the check, mirroring typescript-eslint's `isTypeAnyType` gate. The
// diagnostic anchors on the iterable expression, not the whole statement, so
// the banner points at the offending value. No autofix: upstream ships only a
// manual suggestion here, because dropping the `await` changes runtime
// behavior (e.g. a sync iterable of Promises would stop resolving its
// elements).
func checkAwaitThenableForAwaitOf(ctx *Context, node *shimast.Node) {
  stmt := node.AsForInOrOfStatement()
  if stmt == nil || stmt.AwaitModifier == nil || stmt.Expression == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(stmt.Expression)
  if t == nil || t.Flags()&shimchecker.TypeFlagsAny != 0 {
    return
  }
  if hasCallableWellKnownSymbolProperty(ctx.Checker, stmt.Expression, t, "asyncIterator") {
    return
  }
  ctx.Report(stmt.Expression, "Unexpected `for await...of` of a value that is not async iterable.")
}

// checkAwaitThenableAwaitUsing handles the `await using` arm. Awaiting the
// disposal of a resource that only implements `[Symbol.dispose]` is legal
// (the runtime wraps the sync disposer), but the `await` adds a scheduling
// point with no value, so this port requires every initializer to
// expose a callable `[Symbol.asyncDispose]`. Declarations without an
// initializer (the `for (await using x of ...)` binding form) are skipped, as
// is `any`, mirroring typescript-eslint. Each offending declarator reports on
// its own initializer expression. No autofix: upstream offers only a manual
// suggestion, and only for single-declarator statements.
func checkAwaitThenableAwaitUsing(ctx *Context, node *shimast.Node) {
  if shimast.GetCombinedNodeFlags(node)&shimast.NodeFlagsBlockScoped != shimast.NodeFlagsAwaitUsing {
    return
  }
  list := node.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil {
    return
  }
  for _, declNode := range list.Declarations.Nodes {
    decl := declNode.AsVariableDeclaration()
    if decl == nil || decl.Initializer == nil {
      continue
    }
    t := ctx.Checker.GetTypeAtLocation(decl.Initializer)
    if t == nil || t.Flags()&shimchecker.TypeFlagsAny != 0 {
      continue
    }
    if hasCallableWellKnownSymbolProperty(ctx.Checker, decl.Initializer, t, "asyncDispose") {
      continue
    }
    ctx.Report(decl.Initializer, "Unexpected `await using` of a value that is not async disposable.")
  }
}

// hasCallableWellKnownSymbolProperty reports whether `t` — or, for a union,
// ANY constituent — exposes a callable property keyed by the global
// well-known symbol `Symbol.<symbolName>`:
//
//   - the property NAME is resolved through the checker's own
//     `getPropertyNameForKnownSymbolName`, i.e. through the unique-symbol
//     type of the real global `SymbolConstructor` member, never by matching
//     source text or declared type names;
//   - the property LOOKUP goes through `GetPropertyOfType`, which resolves
//     inherited members, intersections, and type aliases;
//   - the property TYPE is resolved at the source location before checking
//     call signatures, so a same-named non-callable property is not mistaken
//     for an implemented protocol;
//   - constrained type parameters recurse through their base constraint.
//
// Union constituents are tested individually because a union type only
// surfaces properties present on every constituent, while upstream accepts a
// union when at least one constituent implements the protocol (e.g.
// `AsyncIterable<T> | Iterable<T>` stays valid under `for await`).
func hasCallableWellKnownSymbolProperty(
  checker *shimchecker.Checker,
  location *shimast.Node,
  t *shimchecker.Type,
  symbolName string,
) bool {
  if checker == nil || t == nil {
    return false
  }
  if t.Flags()&shimchecker.TypeFlagsTypeParameter != 0 {
    constraint := checker.GetBaseConstraintOfType(t)
    if constraint == nil || constraint == t {
      return false
    }
    return hasCallableWellKnownSymbolProperty(checker, location, constraint, symbolName)
  }
  if t.Flags()&shimchecker.TypeFlagsUnion != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if hasCallableWellKnownSymbolProperty(checker, location, part, symbolName) {
        return true
      }
    }
    return false
  }
  name := shimchecker.Checker_getPropertyNameForKnownSymbolName(checker, symbolName)
  if name == "" {
    return false
  }
  property := checker.GetPropertyOfType(t, name)
  if property == nil {
    return false
  }
  propertyType := checker.GetTypeOfSymbolAtLocation(property, location)
  if propertyType == nil {
    return false
  }
  return len(checker.GetSignaturesOfType(propertyType, shimchecker.SignatureKindCall)) > 0
}

type promiseAwaitability uint8

const (
  promiseAwaitabilityAlways promiseAwaitability = iota
  promiseAwaitabilityNever
  promiseAwaitabilityMay
)

// classifyPromiseAwaitability is the shared await-thenable policy boundary.
// It distinguishes definitely thenable, definitely non-thenable, and unknown
// values so callers can choose their own quantifier. Ordinary `await` reports
// only Never; literal aggregator members report when every union constituent
// is Never; typed container members report when any constituent is Never.
//
// This classifier intentionally does not replace isPromiseTypedExpression.
// no-floating-promises and no-misused-promises use a separate structural
// Promise policy, and adopting this tri-state policy there requires an
// explicit rule decision rather than an incidental helper refactor.
func classifyPromiseAwaitability(
  checker *shimchecker.Checker,
  location *shimast.Node,
  t *shimchecker.Type,
) promiseAwaitability {
  if checker == nil || t == nil {
    return promiseAwaitabilityMay
  }
  if t.Flags()&shimchecker.TypeFlagsTypeParameter != 0 {
    constraint := checker.GetBaseConstraintOfType(t)
    if constraint == nil || constraint == t {
      return promiseAwaitabilityMay
    }
    return classifyPromiseAwaitability(checker, location, constraint)
  }
  if t.Flags()&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown) != 0 {
    return promiseAwaitabilityMay
  }
  if t.Flags()&shimchecker.TypeFlagsUnion != 0 {
    parts := t.Types()
    if len(parts) == 0 {
      return promiseAwaitabilityMay
    }
    classification := classifyPromiseAwaitability(checker, location, parts[0])
    for _, part := range parts[1:] {
      if classifyPromiseAwaitability(checker, location, part) != classification {
        return promiseAwaitabilityMay
      }
    }
    return classification
  }
  if isThenableAtLocation(checker, location, t) {
    return promiseAwaitabilityAlways
  }
  return promiseAwaitabilityNever
}

// isThenableAtLocation mirrors ts-api-utils' thenable predicate. A `then`
// property is valid only when one call signature accepts a first parameter
// whose apparent type is callable. Resolving both symbols at `location`
// mirrors upstream's contextual symbol lookup.
func isThenableAtLocation(checker *shimchecker.Checker, location *shimast.Node, t *shimchecker.Type) bool {
  if checker == nil || t == nil {
    return false
  }
  apparent := checker.GetApparentType(t)
  if apparent == nil {
    return false
  }
  for _, part := range promiseUnionParts(apparent) {
    if part == nil {
      continue
    }
    thenProperty := checker.GetPropertyOfType(part, "then")
    if thenProperty == nil {
      continue
    }
    thenType := checker.GetTypeOfSymbolAtLocation(thenProperty, location)
    for _, thenPart := range promiseUnionParts(thenType) {
      if thenPart == nil {
        continue
      }
      for _, signature := range checker.GetSignaturesOfType(thenPart, shimchecker.SignatureKindCall) {
        parameters := signature.Parameters()
        if len(parameters) > 0 && isCallableCallbackParameter(checker, location, parameters[0]) {
          return true
        }
      }
    }
  }
  return false
}

func isCallableCallbackParameter(
  checker *shimchecker.Checker,
  location *shimast.Node,
  parameter *shimast.Symbol,
) bool {
  if checker == nil || parameter == nil {
    return false
  }
  callbackType := checker.GetTypeOfSymbolAtLocation(parameter, location)
  if callbackType == nil {
    return false
  }
  callbackType = checker.GetApparentType(callbackType)
  if callbackType == nil {
    return false
  }
  if declaration := parameter.ValueDeclaration; declaration != nil {
    if parameterDeclaration := declaration.AsParameterDeclaration(); parameterDeclaration != nil && parameterDeclaration.DotDotDotToken != nil {
      callbackType = checker.GetNumberIndexType(callbackType)
      if callbackType == nil {
        return false
      }
    }
  }
  for _, part := range promiseUnionParts(callbackType) {
    if part != nil && len(checker.GetSignaturesOfType(part, shimchecker.SignatureKindCall)) > 0 {
      return true
    }
  }
  return false
}

func constrainedPromiseType(checker *shimchecker.Checker, t *shimchecker.Type) *shimchecker.Type {
  if checker == nil || t == nil || t.Flags()&shimchecker.TypeFlagsTypeParameter == 0 {
    return t
  }
  if constraint := checker.GetBaseConstraintOfType(t); constraint != nil && constraint != t {
    return constraint
  }
  return t
}

func promiseUnionParts(t *shimchecker.Type) []*shimchecker.Type {
  if t == nil {
    return nil
  }
  if t.Flags()&shimchecker.TypeFlagsUnion != 0 {
    return t.Types()
  }
  return []*shimchecker.Type{t}
}

func promiseTypePartsAllHaveAwaitability(
  checker *shimchecker.Checker,
  location *shimast.Node,
  t *shimchecker.Type,
  want promiseAwaitability,
) bool {
  parts := promiseUnionParts(t)
  if len(parts) == 0 {
    return false
  }
  for _, part := range parts {
    if classifyPromiseAwaitability(checker, location, part) != want {
      return false
    }
  }
  return true
}

func promiseTypePartsHaveAwaitability(
  checker *shimchecker.Checker,
  location *shimast.Node,
  t *shimchecker.Type,
  want promiseAwaitability,
) bool {
  for _, part := range promiseUnionParts(t) {
    if classifyPromiseAwaitability(checker, location, part) == want {
      return true
    }
  }
  return false
}

func promiseAggregatorCallParts(call *shimast.CallExpression) (*shimast.Node, string, bool) {
  if call == nil || call.Expression == nil {
    return nil, "", false
  }
  callee := stripParens(call.Expression)
  if callee == nil {
    return nil, "", false
  }
  var object *shimast.Node
  var method string
  switch callee.Kind {
  case shimast.KindPropertyAccessExpression:
    access := callee.AsPropertyAccessExpression()
    if access == nil {
      return nil, "", false
    }
    object = access.Expression
    method = identifierText(access.Name())
  case shimast.KindElementAccessExpression:
    access := callee.AsElementAccessExpression()
    if access == nil || access.ArgumentExpression == nil {
      return nil, "", false
    }
    object = access.Expression
    switch access.ArgumentExpression.Kind {
    case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
      method = stringLiteralText(access.ArgumentExpression)
    }
  }
  switch method {
  case "all", "allSettled", "any", "race":
    return object, method, object != nil
  }
  return nil, "", false
}

func isNativePromiseConstructorLike(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  return isNativePromiseConstructorLikeSeen(checker, t, map[*shimchecker.Type]struct{}{})
}

func isNativePromiseConstructorLikeSeen(
  checker *shimchecker.Checker,
  t *shimchecker.Type,
  seen map[*shimchecker.Type]struct{},
) bool {
  if checker == nil || t == nil {
    return false
  }
  if _, ok := seen[t]; ok {
    return false
  }
  seen[t] = struct{}{}
  defer delete(seen, t)

  flags := t.Flags()
  if flags&shimchecker.TypeFlagsIntersection != 0 {
    for _, part := range t.Types() {
      if isNativePromiseConstructorLikeSeen(checker, part, seen) {
        return true
      }
    }
    return false
  }
  if flags&shimchecker.TypeFlagsUnion != 0 {
    parts := t.Types()
    if len(parts) == 0 {
      return false
    }
    for _, part := range parts {
      if !isNativePromiseConstructorLikeSeen(checker, part, seen) {
        return false
      }
    }
    return true
  }
  if flags&shimchecker.TypeFlagsTypeParameter != 0 {
    return isNativePromiseConstructorLikeSeen(checker, checker.GetBaseConstraintOfType(t), seen)
  }

  symbol := t.Symbol()
  if symbol == nil {
    return false
  }
  if symbol.Name == "PromiseConstructor" && checker.IsLibSymbolForHoverVerbosity(symbol) {
    return true
  }
  declared := checker.GetDeclaredTypeOfSymbol(symbol)
  if declared == nil || declared.ObjectFlags()&shimchecker.ObjectFlagsClassOrInterface == 0 {
    return false
  }
  for _, base := range checker.GetBaseTypes(declared) {
    if isNativePromiseConstructorLikeSeen(checker, base, seen) {
      return true
    }
  }
  return false
}

func isIterablePromiseAggregatorInput(
  checker *shimchecker.Checker,
  location *shimast.Node,
  t *shimchecker.Type,
) bool {
  parts := promiseUnionParts(t)
  if len(parts) == 0 {
    return false
  }
  for _, part := range parts {
    if !hasCallableWellKnownSymbolProperty(checker, location, part, "iterator") {
      return false
    }
  }
  return true
}

// promiseIterableElementTypes extracts the values produced by synchronous
// iteration. Tuples retain slot-by-slot precision; every other iterable goes
// through TypeScript-Go's checked `[Symbol.iterator]` traversal so a concrete
// container's unrelated generic arguments are never mistaken for its yield
// type.
func promiseIterableElementTypes(checker *shimchecker.Checker, t *shimchecker.Type) []*shimchecker.Type {
  if checker == nil || t == nil {
    return nil
  }
  if shimchecker.IsTupleType(t) {
    return checker.GetTypeArguments(t)
  }
  if elementType := shimchecker.Checker_getSynchronousIterationYieldType(checker, t); elementType != nil {
    return []*shimchecker.Type{elementType}
  }
  return nil
}

// isThenableType reports whether t has a callable `then` property, which is
// the runtime-observable contract for "thenable" in the ES spec. The check
// intentionally mirrors what the JS engine uses at await-time.
func isThenableType(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  if checker == nil || t == nil {
    return false
  }
  prop := checker.GetPropertyOfType(t, "then")
  if prop == nil {
    return false
  }
  propType := checker.GetTypeOfSymbol(prop)
  if propType == nil {
    return false
  }
  return len(checker.GetSignaturesOfType(propType, shimchecker.SignatureKindCall)) > 0
}

// noFloatingPromises rejects discarded built-in Promises and, when requested,
// catchable structural thenables. A Promise is handled only by await, the
// configured void escape hatch, or a callable rejection handler; finally
// preserves the receiver's handled state rather than swallowing rejection.
// typescript-eslint recommended-type-checked:
// https://typescript-eslint.io/rules/no-floating-promises/
//
// Only ExpressionStatement is visited because assignments, returns, and call
// arguments transfer ownership. Recursive analysis is still required inside a
// statement: sequence expressions hide earlier values, logical and conditional
// branches hide Promise-producing alternatives, and arrays retain every
// Promise element even though the container itself is not awaitable.
type noFloatingPromises struct{ optionsRule }

type noFloatingPromisesOptions struct {
  AllowForKnownSafeCalls    []promiseTypeOrValueSpecifier `json:"allowForKnownSafeCalls"`
  AllowForKnownSafePromises []promiseTypeOrValueSpecifier `json:"allowForKnownSafePromises"`
  CheckThenables            bool                          `json:"checkThenables"`
  IgnoreIIFE                bool                          `json:"ignoreIIFE"`
  IgnoreVoid                *bool                         `json:"ignoreVoid"`
}

type promiseTypeOrValueSpecifier struct {
  From        string
  Names       []string
  Path        string
  PackageName string
  Universal   bool
}

func (s *promiseTypeOrValueSpecifier) UnmarshalJSON(data []byte) error {
  var name string
  if err := json.Unmarshal(data, &name); err == nil {
    s.Names = []string{name}
    s.Universal = true
    return nil
  }

  var raw struct {
    From    string          `json:"from"`
    Name    json.RawMessage `json:"name"`
    Path    string          `json:"path"`
    Package string          `json:"package"`
  }
  if err := json.Unmarshal(data, &raw); err != nil {
    return err
  }
  if err := json.Unmarshal(raw.Name, &name); err == nil {
    s.Names = []string{name}
  } else if err := json.Unmarshal(raw.Name, &s.Names); err != nil {
    return err
  }
  s.From = raw.From
  s.Path = raw.Path
  s.PackageName = raw.Package
  return nil
}

func (o noFloatingPromisesOptions) ignoresVoid() bool {
  return o.IgnoreVoid == nil || *o.IgnoreVoid
}

type floatingPromiseResult struct {
  unhandled          bool
  nonFunctionHandler bool
  promiseArray       bool
}

func (noFloatingPromises) Name() string { return "typescript/no-floating-promises" }
func (noFloatingPromises) NeedsTypeChecker() bool {
  return true
}
func (noFloatingPromises) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindExpressionStatement}
}
func (noFloatingPromises) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  stmt := node.AsExpressionStatement()
  if stmt == nil || stmt.Expression == nil {
    return
  }
  expr := unwrapFloatingPromiseExpression(stmt.Expression)
  if expr == nil {
    return
  }
  var options noFloatingPromisesOptions
  _ = ctx.DecodeOptions(&options)
  if options.IgnoreIIFE && isImmediatelyInvokedFunctionExpression(expr) {
    return
  }
  result := analyzeFloatingPromise(ctx, expr, options)
  if !result.unhandled {
    return
  }
  message := floatingPromiseMessage(options.ignoresVoid(), result)
  ctx.Report(node, message)
}

func floatingPromiseMessage(ignoreVoid bool, result floatingPromiseResult) string {
  if result.promiseArray {
    message := "An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar"
    if ignoreVoid {
      return message + ", or explicitly marking the expression as ignored with the `void` operator."
    }
    return message + "."
  }
  message := "Promises must be awaited, end with a call to .catch, or end with a call to .then with a rejection handler."
  if ignoreVoid {
    message = "Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator."
  }
  if result.nonFunctionHandler {
    message += " A rejection handler that is not a function will be ignored."
  }
  return message
}

func analyzeFloatingPromise(
  ctx *Context,
  node *shimast.Node,
  options noFloatingPromisesOptions,
) floatingPromiseResult {
  node = unwrapFloatingPromiseExpression(node)
  if node == nil {
    return floatingPromiseResult{}
  }

  // A configured safe call stays safe wherever recursive expression analysis
  // reaches it. The callee's symbol/source identity is unchanged by a comma,
  // logical, conditional, or void parent, so the allowlist decision belongs
  // at the call node rather than only at the root expression statement.
  if isKnownSafePromiseCall(ctx, node, options.AllowForKnownSafeCalls) {
    return floatingPromiseResult{}
  }

  if isAssignmentExpression(node) {
    return floatingPromiseResult{}
  }

  if node.Kind == shimast.KindBinaryExpression {
    binary := node.AsBinaryExpression()
    if binary != nil && binary.OperatorToken != nil && binary.OperatorToken.Kind == shimast.KindCommaToken {
      if result := analyzeFloatingPromise(ctx, binary.Left, options); result.unhandled {
        return result
      }
      return analyzeFloatingPromise(ctx, binary.Right, options)
    }
  }

  if !options.ignoresVoid() && node.Kind == shimast.KindVoidExpression {
    expression := node.AsVoidExpression()
    if expression == nil {
      return floatingPromiseResult{}
    }
    return analyzeFloatingPromise(ctx, expression.Expression, options)
  }

  t := ctx.Checker.GetTypeAtLocation(node)
  if t == nil {
    return floatingPromiseResult{}
  }
  if isFloatingPromiseArray(ctx, node, t, options) {
    return floatingPromiseResult{unhandled: true, promiseArray: true}
  }
  if node.Kind == shimast.KindArrayLiteralExpression {
    array := node.AsArrayLiteralExpression()
    if array != nil && array.Elements != nil {
      for _, element := range array.Elements.Nodes {
        element = unwrapFloatingPromiseExpression(element)
        if element != nil && element.Kind == shimast.KindSpreadElement {
          if spread := element.AsSpreadElement(); spread != nil {
            element = unwrapFloatingPromiseExpression(spread.Expression)
          }
        }
        if element == nil {
          continue
        }
        elementType := ctx.Checker.GetTypeAtLocation(element)
        if elementType != nil && (isFloatingPromiseType(ctx, element, elementType, options) ||
          isFloatingPromiseArray(ctx, element, elementType, options)) {
          return floatingPromiseResult{unhandled: true, promiseArray: true}
        }
        if result := analyzeFloatingPromise(ctx, element, options); result.unhandled {
          return floatingPromiseResult{unhandled: true, promiseArray: true}
        }
      }
    }
  }
  if node.Kind == shimast.KindAwaitExpression {
    return floatingPromiseResult{}
  }
  callResultIsFloating := isFloatingPromiseType(ctx, node, t, options)
  if node.Kind == shimast.KindCallExpression {
    return analyzeFloatingPromiseCall(ctx, node, options, callResultIsFloating)
  }

  switch node.Kind {
  case shimast.KindConditionalExpression:
    conditional := node.AsConditionalExpression()
    if conditional == nil {
      return floatingPromiseResult{unhandled: true}
    }
    if result := analyzeFloatingPromise(ctx, conditional.WhenFalse, options); result.unhandled {
      return result
    }
    return analyzeFloatingPromise(ctx, conditional.WhenTrue, options)
  case shimast.KindBinaryExpression:
    binary := node.AsBinaryExpression()
    if binary != nil && binary.OperatorToken != nil {
      switch binary.OperatorToken.Kind {
      case shimast.KindAmpersandAmpersandToken,
        shimast.KindBarBarToken,
        shimast.KindQuestionQuestionToken:
        if result := analyzeFloatingPromise(ctx, binary.Left, options); result.unhandled {
          return result
        }
        return analyzeFloatingPromise(ctx, binary.Right, options)
      }
    }
  }
  if !callResultIsFloating {
    return floatingPromiseResult{}
  }
  return floatingPromiseResult{unhandled: true}
}

func analyzeFloatingPromiseCall(
  ctx *Context,
  node *shimast.Node,
  options noFloatingPromisesOptions,
  callResultIsFloating bool,
) floatingPromiseResult {
  call := node.AsCallExpression()
  if call == nil {
    return floatingPromiseResult{unhandled: callResultIsFloating}
  }
  receiver, method, ok := floatingPromiseMethodCall(call)
  if !ok {
    return floatingPromiseResult{unhandled: callResultIsFloating}
  }

  receiverType := ctx.Checker.GetTypeAtLocation(receiver)
  if receiverType == nil {
    return floatingPromiseResult{unhandled: callResultIsFloating}
  }
  apparent := ctx.Checker.GetApparentType(receiverType)
  if apparent == nil {
    return floatingPromiseResult{unhandled: callResultIsFloating}
  }

  var nonPromiseReceivers []*shimchecker.Type
  sawPromiseReceiver := false
  sawUnsafePromiseReceiver := false
  // A thenable receiver the option leaves out of scope is not the same as a
  // receiver that is not promise-like at all. Upstream's `checkThenables`
  // decides which types the rule examines — "whether to check all Thenables,
  // not just the built-in Promise type" — so with the option off a thenable is
  // outside the rule, not an unhandled promise. Collapsing the two is what made
  // `false` the strict setting here and `true` the lenient one, the exact
  // inversion of the option this borrows its name from.
  sawOutOfScopeThenable := false
  receiverIsOptional := floatingPromisePropertyAccessIsOptional(call.Expression)
  for _, part := range promiseUnionParts(apparent) {
    if part == nil {
      continue
    }
    if receiverIsOptional && part.Flags()&(shimchecker.TypeFlagsNull|shimchecker.TypeFlagsUndefined) != 0 {
      continue
    }

    if typeMatchesSomePromiseSpecifier(ctx, part, options.AllowForKnownSafePromises) {
      sawPromiseReceiver = true
      continue
    }
    if isNativePromiseInstanceLike(ctx.Checker, part) {
      sawPromiseReceiver = true
      sawUnsafePromiseReceiver = true
      continue
    }
    if isCatchableThenableAtLocation(ctx.Checker, receiver, part) {
      if options.CheckThenables {
        sawPromiseReceiver = true
        sawUnsafePromiseReceiver = true
        continue
      }
      sawOutOfScopeThenable = true
      continue
    }
    nonPromiseReceivers = append(nonPromiseReceivers, part)
  }
  if !sawPromiseReceiver {
    if sawOutOfScopeThenable && len(nonPromiseReceivers) == 0 {
      return floatingPromiseResult{}
    }
    return floatingPromiseResult{unhandled: callResultIsFloating}
  }

  // A Promise type covered by allowForKnownSafePromises may be discarded
  // without proving a rejection handler. Preserve that contract when every
  // Promise receiver branch and the call result are safe, while still checking
  // unsafe Promise branches and unsafe results returned from a safe subtype.
  if sawUnsafePromiseReceiver || callResultIsFloating {
    switch method {
    case "catch":
      if result := rejectionHandlerResult(ctx, call, 0); result.unhandled {
        return result
      }
    case "then":
      if call.Arguments != nil && len(call.Arguments.Nodes) != 0 && call.Arguments.Nodes[0].Kind == shimast.KindSpreadElement {
        return floatingPromiseResult{unhandled: true}
      }
      if result := rejectionHandlerResult(ctx, call, 1); result.unhandled {
        return result
      }
    case "finally":
      if result := analyzeFloatingPromise(ctx, receiver, options); result.unhandled {
        return result
      }
    default:
      return floatingPromiseResult{unhandled: true}
    }
  }

  for _, part := range nonPromiseReceivers {
    if floatingPromiseMethodReturnIsUnhandled(ctx, node, call, part, method, options) {
      return floatingPromiseResult{unhandled: true}
    }
  }
  return floatingPromiseResult{}
}

func rejectionHandlerResult(ctx *Context, call *shimast.CallExpression, index int) floatingPromiseResult {
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) <= index {
    return floatingPromiseResult{unhandled: true}
  }
  handler := unwrapFloatingPromiseExpression(call.Arguments.Nodes[index])
  if handler == nil || handler.Kind == shimast.KindSpreadElement {
    return floatingPromiseResult{unhandled: true}
  }
  t := ctx.Checker.GetTypeAtLocation(handler)
  if t != nil && len(ctx.Checker.GetSignaturesOfType(t, shimchecker.SignatureKindCall)) > 0 {
    return floatingPromiseResult{}
  }
  return floatingPromiseResult{unhandled: true, nonFunctionHandler: true}
}

// floatingPromiseMethodCall extracts only the three Promise protocol method
// shapes. analyzeFloatingPromiseCall separately proves which receiver branches
// implement that protocol and inspects the return types of every other branch.
func floatingPromiseMethodCall(call *shimast.CallExpression) (*shimast.Node, string, bool) {
  if call == nil || call.Expression == nil {
    return nil, "", false
  }
  receiver, method, ok := floatingPromisePropertyAccessParts(call.Expression)
  if !ok {
    return nil, "", false
  }
  switch method {
  case "catch", "then", "finally":
  default:
    return nil, "", false
  }
  receiver = unwrapFloatingPromiseExpression(receiver)
  if receiver == nil {
    return nil, "", false
  }
  return receiver, method, true
}

// floatingPromisePropertyAccessIsOptional reports whether a null or undefined
// branch of the receiver's type is unreachable at this access.
//
// The guard is not only the access's own `?.`. An optional chain short-circuits
// as a whole, so in `maybe?.run().catch(handler)` the `.catch` access is never
// evaluated when `maybe` is nullish, even though it carries no `?.` of its own.
// Reading only the outermost token left the `undefined` branch of
// `Promise<void> | undefined` looking like a real receiver, and the rule
// reported a chain that ends in a callable rejection handler.
//
// The walk deliberately does not strip parentheses as it descends. A
// parenthesized sub-expression ends the chain — `(maybe?.run()).catch(handler)`
// really can throw — so that shape must keep its nullish branch.
func floatingPromisePropertyAccessIsOptional(node *shimast.Node) bool {
  current := stripParens(node)
  for current != nil {
    switch current.Kind {
    case shimast.KindPropertyAccessExpression:
      access := current.AsPropertyAccessExpression()
      if access == nil {
        return false
      }
      if access.QuestionDotToken != nil {
        return true
      }
      current = access.Expression
    case shimast.KindElementAccessExpression:
      access := current.AsElementAccessExpression()
      if access == nil {
        return false
      }
      if access.QuestionDotToken != nil {
        return true
      }
      current = access.Expression
    case shimast.KindCallExpression:
      call := current.AsCallExpression()
      if call == nil {
        return false
      }
      current = call.Expression
    default:
      return false
    }
  }
  return false
}

// floatingPromiseMethodReturnIsUnhandled determines what a non-Promise
// receiver branch contributes to the union call. Method names alone are not a
// Promise escape: a provably applicable callable signature must return a value
// that is safe to discard under the same Promise and thenable options as the
// outer expression.
func floatingPromiseMethodReturnIsUnhandled(
  ctx *Context,
  node *shimast.Node,
  call *shimast.CallExpression,
  receiverType *shimchecker.Type,
  method string,
  options noFloatingPromisesOptions,
) bool {
  property := ctx.Checker.GetPropertyOfType(receiverType, method)
  if property == nil {
    return true
  }
  propertyType := ctx.Checker.GetTypeOfSymbolAtLocation(property, call.Expression)
  if propertyType == nil {
    return true
  }

  sawBranch := false
  for _, part := range promiseUnionParts(propertyType) {
    if part == nil {
      continue
    }
    if call.QuestionDotToken != nil && part.Flags()&(shimchecker.TypeFlagsNull|shimchecker.TypeFlagsUndefined) != 0 {
      sawBranch = true
      continue
    }
    signatures := ctx.Checker.GetSignaturesOfType(part, shimchecker.SignatureKindCall)
    if len(signatures) == 0 {
      if apparent := ctx.Checker.GetApparentType(part); apparent != nil && apparent != part {
        signatures = ctx.Checker.GetSignaturesOfType(apparent, shimchecker.SignatureKindCall)
      }
    }
    if len(signatures) == 0 {
      return true
    }
    sawBranch = true
    signature := floatingPromiseApplicableSignature(ctx, call, signatures)
    if signature == nil {
      return true
    }
    if floatingPromiseSignatureReturnIsUnhandled(ctx, node, call, signature, options) {
      return true
    }
  }
  return !sawBranch
}

// floatingPromiseApplicableSignature selects an overload only when public
// Checker queries prove its arity and argument types accept this call. Multiple
// candidates are accepted only when their parameter contracts are equivalent.
// This is deliberately a lint-side proof, not a second call resolver: uncertain
// generic or spread cases remain unhandled instead of entering the private,
// stateful resolveCall path with a candidate subset.
func floatingPromiseApplicableSignature(
  ctx *Context,
  call *shimast.CallExpression,
  signatures []*shimchecker.Signature,
) *shimchecker.Signature {
  if ctx == nil || ctx.Checker == nil || call == nil || len(signatures) == 0 {
    return nil
  }
  var applicable []*shimchecker.Signature
  for _, signature := range signatures {
    switch floatingPromiseSignatureApplicability(ctx.Checker, call, signature) {
    case floatingPromiseCallApplicable:
      applicable = append(applicable, signature)
    case floatingPromiseCallIncompatible:
      continue
    case floatingPromiseCallUncertain:
      return nil
    default:
      return nil
    }
  }
  if len(applicable) == 1 {
    return applicable[0]
  }
  if len(applicable) == 0 || !floatingPromiseEquivalentOverloads(ctx.Checker, call, applicable) {
    return nil
  }
  // TypeScript selects the first declaration when otherwise-identical
  // overloads are repeated. Preserve that specified source-order behavior,
  // but do not guess between merely overlapping parameter types.
  return applicable[0]
}

type floatingPromiseCallApplicability uint8

const (
  floatingPromiseCallUncertain floatingPromiseCallApplicability = iota
  floatingPromiseCallIncompatible
  floatingPromiseCallApplicable
)

func floatingPromiseEquivalentOverloads(
  checker *shimchecker.Checker,
  call *shimast.CallExpression,
  signatures []*shimchecker.Signature,
) bool {
  if checker == nil || call == nil || len(signatures) < 2 {
    return false
  }
  first := signatures[0]
  firstParameters := first.Parameters()
  firstDeclaration := first.Declaration()
  stableSourceOrder := firstDeclaration != nil
  firstHasLiteralParameters := floatingPromiseSignatureHasLiteralParameters(first)
  if first.HasRestParameter() || len(first.TypeParameters()) != 0 {
    return false
  }
  for _, signature := range signatures[1:] {
    parameters := signature.Parameters()
    if len(parameters) != len(firstParameters) ||
      signature.HasRestParameter() != first.HasRestParameter() ||
      shimchecker.Checker_getMinArgumentCount(checker, signature) != shimchecker.Checker_getMinArgumentCount(checker, first) ||
      len(signature.TypeParameters()) != len(first.TypeParameters()) {
      return false
    }
    for index := range firstParameters {
      left := floatingPromiseParameterType(checker, call, first, index)
      right := floatingPromiseParameterType(checker, call, signature, index)
      if left == nil || right == nil ||
        left.Flags()&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown) != 0 ||
        right.Flags()&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown) != 0 ||
        !checker.IsTypeAssignableTo(left, right) ||
        !checker.IsTypeAssignableTo(right, left) {
        return false
      }
    }
    declaration := signature.Declaration()
    if declaration == nil || firstDeclaration == nil ||
      declaration.Parent != firstDeclaration.Parent {
      stableSourceOrder = false
    }
    if !floatingPromiseSignatureParametersHaveSameSyntax(first, signature) {
      stableSourceOrder = false
    }
    if !firstHasLiteralParameters && floatingPromiseSignatureHasLiteralParameters(signature) {
      stableSourceOrder = false
    }
  }
  if stableSourceOrder {
    return true
  }
  // TypeScript's reorderCandidates reverses declaration-block groups for one
  // merged symbol. When public data cannot prove stable source order, selecting
  // an arbitrary declaration is safe only if every possible selection has the
  // exact same return type.
  firstReturn := checker.GetReturnTypeOfSignature(first)
  if firstReturn == nil {
    return false
  }
  for _, signature := range signatures[1:] {
    if checker.GetReturnTypeOfSignature(signature) != firstReturn {
      return false
    }
  }
  return true
}

func floatingPromiseSignatureParametersHaveSameSyntax(
  left *shimchecker.Signature,
  right *shimchecker.Signature,
) bool {
  if left == nil || right == nil || left.Declaration() == nil || right.Declaration() == nil {
    return false
  }
  leftParameters := left.Declaration().Parameters()
  rightParameters := right.Declaration().Parameters()
  if len(leftParameters) != len(rightParameters) {
    return false
  }
  for index := range leftParameters {
    if leftParameters[index] == nil || rightParameters[index] == nil {
      return false
    }
    leftType := leftParameters[index].Type()
    rightType := rightParameters[index].Type()
    if leftType == nil || rightType == nil || leftType.Kind != rightType.Kind {
      return false
    }
    leftText := shimast.NodeText(leftType)
    rightText := shimast.NodeText(rightType)
    if leftText == "" || rightText == "" || leftText != rightText {
      return false
    }
  }
  return true
}

func floatingPromiseSignatureHasLiteralParameters(signature *shimchecker.Signature) bool {
  if signature == nil || signature.Declaration() == nil {
    return false
  }
  for _, parameter := range signature.Declaration().Parameters() {
    if parameter != nil && parameter.Type() != nil && parameter.Type().Kind == shimast.KindLiteralType {
      return true
    }
  }
  return false
}

func floatingPromiseSignatureApplicability(
  checker *shimchecker.Checker,
  call *shimast.CallExpression,
  signature *shimchecker.Signature,
) floatingPromiseCallApplicability {
  if checker == nil || call == nil || signature == nil {
    return floatingPromiseCallUncertain
  }
  if signature.ThisParameter() != nil {
    return floatingPromiseCallUncertain
  }
  arguments := []*shimast.Node(nil)
  if call.Arguments != nil {
    arguments = call.Arguments.Nodes
  }
  parameters := signature.Parameters()
  if len(arguments) < shimchecker.Checker_getMinArgumentCount(checker, signature) {
    return floatingPromiseCallIncompatible
  }
  // Array and tuple rest parameters require TypeScript's position-sensitive
  // effective-rest expansion, including a bounded tuple's maximum arity. A
  // number-index union cannot prove either property without the resolver.
  if signature.HasRestParameter() {
    return floatingPromiseCallUncertain
  }
  if len(arguments) > len(parameters) {
    return floatingPromiseCallIncompatible
  }
  typeArguments := call.AsNode().TypeArguments()
  typeParameters := signature.TypeParameters()
  if len(typeArguments) > len(typeParameters) || (len(typeArguments) != 0 && len(typeParameters) == 0) {
    return floatingPromiseCallIncompatible
  }
  if len(typeParameters) != 0 {
    return floatingPromiseGenericSignatureApplicability(
      checker,
      call,
      signature,
      arguments,
      typeArguments,
      typeParameters,
    )
  }
  for index, argument := range arguments {
    if argument == nil {
      return floatingPromiseCallUncertain
    }
    if argument.Kind == shimast.KindSpreadElement {
      return floatingPromiseCallUncertain
    }
    if floatingPromiseExpressionNeedsCandidateContext(checker, argument) {
      return floatingPromiseCallUncertain
    }
    parameterType := floatingPromiseParameterType(checker, call, signature, index)
    argumentType := checker.GetTypeAtLocation(argument)
    if parameterType == nil || argumentType == nil {
      return floatingPromiseCallUncertain
    }
    if floatingPromiseFunctionArgument(argument) {
      if !floatingPromiseTypeMayAcceptFunction(checker, parameterType) {
        if checker.IsTypeAssignableTo(argumentType, parameterType) {
          continue
        }
        return floatingPromiseCallIncompatible
      }
      if parameterType.Flags()&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown) != 0 {
        if checker.IsTypeAssignableTo(argumentType, parameterType) {
          continue
        }
        return floatingPromiseCallIncompatible
      }
      applicability := floatingPromiseCallableArgumentApplicability(
        checker,
        call,
        argument,
        parameterType,
        nil,
        nil,
        nil,
      )
      if applicability != floatingPromiseCallApplicable {
        return applicability
      }
      continue
    }
    if checker.IsContextSensitive(argument) {
      return floatingPromiseCallUncertain
    }
    if !checker.IsTypeAssignableTo(argumentType, parameterType) {
      return floatingPromiseCallIncompatible
    }
  }
  return floatingPromiseCallApplicable
}

// floatingPromiseGenericSignatureApplicability proves the deliberately small
// generic subset whose result can be correlated without instantiating a
// candidate through TypeScript's private resolver. Every argument must match a
// fixed parameter or provide a direct, constraint-valid inference for a naked
// type parameter. Callback inference is accepted only after its complete input
// contract and return are checked.
func floatingPromiseGenericSignatureApplicability(
  checker *shimchecker.Checker,
  call *shimast.CallExpression,
  signature *shimchecker.Signature,
  arguments []*shimast.Node,
  typeArgumentNodes []*shimast.Node,
  typeParameters []*shimchecker.Type,
) floatingPromiseCallApplicability {
  if len(typeArgumentNodes) != 0 && len(typeArgumentNodes) < checker.GetMinTypeArgumentCount(typeParameters) {
    return floatingPromiseCallIncompatible
  }
  explicit := make([]*shimchecker.Type, len(typeParameters))
  for index, typeArgumentNode := range typeArgumentNodes {
    if typeArgumentNode == nil {
      return floatingPromiseCallUncertain
    }
    typeArgument := checker.GetTypeFromTypeNode(typeArgumentNode)
    if typeArgument == nil {
      return floatingPromiseCallUncertain
    }
    applicability := floatingPromiseTypeParameterCandidateApplicability(
      checker,
      typeParameters[index],
      typeArgument,
      typeParameters,
      call.Expression,
    )
    if applicability != floatingPromiseCallApplicable {
      return applicability
    }
    explicit[index] = typeArgument
  }
  if len(typeArgumentNodes) != 0 {
    // TypeScript does not infer omitted type arguments after the caller has
    // supplied an explicit prefix. Its public FillMissingTypeArguments query
    // applies and instantiates every remaining default with the same mapper.
    explicit = checker.FillMissingTypeArguments(
      explicit[:len(typeArgumentNodes)],
      typeParameters,
      checker.GetMinTypeArgumentCount(typeParameters),
      floatingPromiseSignatureIsJavaScript(signature),
    )
    if len(explicit) != len(typeParameters) {
      return floatingPromiseCallUncertain
    }
  }

  inferred := make(map[*shimchecker.Type][]*shimchecker.Type, len(typeParameters))
  for index, argument := range arguments {
    if argument == nil || argument.Kind == shimast.KindSpreadElement {
      return floatingPromiseCallUncertain
    }
    parameterType := floatingPromiseParameterType(checker, call, signature, index)
    if parameterType == nil {
      return floatingPromiseCallUncertain
    }
    applicability := floatingPromiseGenericArgumentApplicability(
      checker,
      call,
      argument,
      parameterType,
      typeParameters,
      explicit,
      inferred,
    )
    if applicability != floatingPromiseCallApplicable {
      return applicability
    }
  }

  for index, typeParameter := range typeParameters {
    if explicit[index] != nil {
      continue
    }
    candidates := inferred[typeParameter]
    if len(candidates) != 0 {
      if !floatingPromiseInferencesHaveWitness(checker, candidates) {
        return floatingPromiseCallUncertain
      }
      continue
    }
    defaultType := checker.GetDefaultFromTypeParameter(typeParameter)
    if defaultType == nil {
      return floatingPromiseCallUncertain
    }
    applicability := floatingPromiseTypeParameterCandidateApplicability(
      checker,
      typeParameter,
      defaultType,
      typeParameters,
      call.Expression,
    )
    if applicability != floatingPromiseCallApplicable {
      return applicability
    }
  }
  return floatingPromiseCallApplicable
}

func floatingPromiseGenericArgumentApplicability(
  checker *shimchecker.Checker,
  call *shimast.CallExpression,
  argument *shimast.Node,
  parameterType *shimchecker.Type,
  typeParameters []*shimchecker.Type,
  explicit []*shimchecker.Type,
  inferred map[*shimchecker.Type][]*shimchecker.Type,
) floatingPromiseCallApplicability {
  if floatingPromiseExpressionNeedsCandidateContext(checker, argument) {
    return floatingPromiseCallUncertain
  }
  argumentType := checker.GetTypeAtLocation(argument)
  if argumentType == nil {
    return floatingPromiseCallUncertain
  }
  if typeParameterIndex := floatingPromiseTypeParameterIndex(typeParameters, parameterType); typeParameterIndex >= 0 {
    if checker.IsContextSensitive(argument) {
      return floatingPromiseCallUncertain
    }
    typeParameter := typeParameters[typeParameterIndex]
    if explicitType := explicit[typeParameterIndex]; explicitType != nil {
      if checker.IsTypeAssignableTo(argumentType, explicitType) {
        return floatingPromiseCallApplicable
      }
      return floatingPromiseCallIncompatible
    }
    applicability := floatingPromiseTypeParameterCandidateApplicability(
      checker,
      typeParameter,
      argumentType,
      typeParameters,
      call.Expression,
    )
    if applicability != floatingPromiseCallApplicable {
      return applicability
    }
    inferred[typeParameter] = append(inferred[typeParameter], argumentType)
    return floatingPromiseCallApplicable
  }
  if parameterType.Flags()&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown) != 0 {
    if checker.IsTypeAssignableTo(argumentType, parameterType) {
      return floatingPromiseCallApplicable
    }
    return floatingPromiseCallIncompatible
  }
  if floatingPromiseTypeContainsOpaqueMappedObject(checker, parameterType, nil) {
    // Reverse inference from mapped types depends on private mapped-type
    // constraints and templates that the public Checker surface does not
    // expose. In particular, a mapped constituent can report no properties or
    // index infos while still inferring a method type parameter.
    return floatingPromiseCallUncertain
  }

  apparentParameter := checker.GetApparentType(parameterType)
  if apparentParameter != nil && len(checker.GetSignaturesOfType(apparentParameter, shimchecker.SignatureKindCall)) != 0 {
    return floatingPromiseCallableArgumentApplicability(
      checker,
      call,
      argument,
      parameterType,
      typeParameters,
      explicit,
      inferred,
    )
  }
  if floatingPromiseTypeContainsAnyTypeParameter(checker, parameterType, typeParameters, call.Expression, nil) {
    return floatingPromiseCallUncertain
  }
  if checker.IsContextSensitive(argument) {
    // Object, array, and branching literals require the candidate-specific
    // contextual mapper that is intentionally unavailable here.
    return floatingPromiseCallUncertain
  }
  if checker.IsTypeAssignableTo(argumentType, parameterType) {
    return floatingPromiseCallApplicable
  }
  return floatingPromiseCallIncompatible
}

func floatingPromiseCallableArgumentApplicability(
  checker *shimchecker.Checker,
  call *shimast.CallExpression,
  argument *shimast.Node,
  parameterType *shimchecker.Type,
  typeParameters []*shimchecker.Type,
  explicit []*shimchecker.Type,
  inferred map[*shimchecker.Type][]*shimchecker.Type,
) floatingPromiseCallApplicability {
  argumentType := checker.GetTypeAtLocation(argument)
  if argumentType == nil {
    return floatingPromiseCallUncertain
  }
  expectedType := checker.GetApparentType(parameterType)
  actualType := checker.GetApparentType(argumentType)
  if expectedType == nil || actualType == nil {
    return floatingPromiseCallUncertain
  }
  expectedSignatures := checker.GetSignaturesOfType(expectedType, shimchecker.SignatureKindCall)
  actualSignatures := checker.GetSignaturesOfType(actualType, shimchecker.SignatureKindCall)
  if len(expectedSignatures) != 1 {
    return floatingPromiseCallUncertain
  }
  if len(actualSignatures) == 0 {
    return floatingPromiseCallIncompatible
  }
  if len(actualSignatures) != 1 {
    return floatingPromiseCallUncertain
  }
  expected := expectedSignatures[0]
  actual := actualSignatures[0]
  if expected.HasRestParameter() || actual.HasRestParameter() ||
    expected.ThisParameter() != nil || actual.ThisParameter() != nil ||
    len(expected.TypeParameters()) != 0 || len(actual.TypeParameters()) != 0 {
    return floatingPromiseCallUncertain
  }
  if checker.GetTypePredicateOfSignature(expected) != nil ||
    checker.GetTypePredicateOfSignature(actual) != nil {
    return floatingPromiseCallUncertain
  }
  if len(checker.GetSignaturesOfType(expectedType, shimchecker.SignatureKindConstruct)) != 0 ||
    len(checker.GetIndexInfosOfType(expectedType)) != 0 {
    return floatingPromiseCallUncertain
  }
  for _, expectedProperty := range shimchecker.Checker_getPropertiesOfType(checker, expectedType) {
    expectedOptional := expectedProperty.Flags&shimast.SymbolFlagsOptional != 0
    actualProperty := checker.GetPropertyOfType(actualType, expectedProperty.Name)
    if actualProperty == nil {
      if expectedOptional {
        continue
      }
      return floatingPromiseCallIncompatible
    }
    if !expectedOptional && actualProperty.Flags&shimast.SymbolFlagsOptional != 0 {
      return floatingPromiseCallIncompatible
    }
    if floatingPromiseSymbolHasNonPublicDeclaration(expectedProperty) ||
      floatingPromiseSymbolHasNonPublicDeclaration(actualProperty) {
      return floatingPromiseCallUncertain
    }
    expectedPropertyType := checker.GetTypeOfSymbolAtLocation(expectedProperty, call.Expression)
    actualPropertyType := checker.GetTypeOfSymbolAtLocation(actualProperty, argument)
    if expectedPropertyType == nil || actualPropertyType == nil {
      return floatingPromiseCallUncertain
    }
    if floatingPromiseTypeContainsAnyTypeParameter(
      checker,
      expectedPropertyType,
      typeParameters,
      call.Expression,
      nil,
    ) {
      return floatingPromiseCallUncertain
    }
    if !checker.IsTypeAssignableTo(actualPropertyType, expectedPropertyType) {
      return floatingPromiseCallIncompatible
    }
  }
  expectedParameters := expected.Parameters()
  actualParameters := actual.Parameters()
  if shimchecker.Checker_getMinArgumentCount(checker, actual) >
    shimchecker.Checker_getMinArgumentCount(checker, expected) {
    // Function compatibility uses effective target parameter counts and then
    // applies optional-parameter and callback-variance rules. Comparing the
    // two minima alone cannot conclusively exclude this candidate.
    return floatingPromiseCallUncertain
  }
  comparableParameters := len(actualParameters)
  if comparableParameters > len(expectedParameters) {
    comparableParameters = len(expectedParameters)
  }
  for index := 0; index < comparableParameters; index++ {
    expectedParameter := floatingPromiseSignatureParameterType(
      checker,
      expected,
      index,
      call.Expression,
    )
    actualParameter := floatingPromiseSignatureParameterType(checker, actual, index, argument)
    if expectedParameter == nil || actualParameter == nil {
      return floatingPromiseCallUncertain
    }
    if floatingPromiseTypeContainsAnyTypeParameter(checker, expectedParameter, typeParameters, call.Expression, nil) {
      return floatingPromiseCallUncertain
    }
    if !checker.IsTypeAssignableTo(expectedParameter, actualParameter) {
      // Callback parameter variance depends on the target declaration kind
      // and strictFunctionTypes. A raw parameter-to-parameter comparison can
      // therefore disprove neither method bivariance nor a candidate-specific
      // contextual comparison.
      return floatingPromiseCallUncertain
    }
  }

  expectedReturn := checker.GetReturnTypeOfSignature(expected)
  actualReturn := checker.GetReturnTypeOfSignature(actual)
  if expectedReturn == nil || actualReturn == nil {
    return floatingPromiseCallUncertain
  }
  implicitReturn := floatingPromiseFunctionHasImplicitReturnType(argument)
  returnNeedsContext := floatingPromiseFunctionReturnNeedsCandidateContext(checker, argument)
  if typeParameterIndex := floatingPromiseTypeParameterIndex(typeParameters, expectedReturn); typeParameterIndex >= 0 {
    typeParameter := typeParameters[typeParameterIndex]
    if explicitType := explicit[typeParameterIndex]; explicitType != nil {
      if explicitType.Flags()&shimchecker.TypeFlagsVoid != 0 {
        return floatingPromiseCallApplicable
      }
      if returnNeedsContext {
        return floatingPromiseCallUncertain
      }
      if checker.IsTypeAssignableTo(actualReturn, explicitType) {
        return floatingPromiseCallApplicable
      }
      if implicitReturn || checker.IsContextSensitive(argument) {
        return floatingPromiseCallUncertain
      }
      return floatingPromiseCallIncompatible
    }
    applicability := floatingPromiseTypeParameterCandidateApplicability(
      checker,
      typeParameter,
      actualReturn,
      typeParameters,
      call.Expression,
    )
    if applicability != floatingPromiseCallApplicable {
      if applicability == floatingPromiseCallIncompatible &&
        (implicitReturn || checker.IsContextSensitive(argument)) {
        return floatingPromiseCallUncertain
      }
      return applicability
    }
    if returnNeedsContext && checker.GetConstraintOfTypeParameter(typeParameter) != nil {
      return floatingPromiseCallUncertain
    }
    inferred[typeParameter] = append(inferred[typeParameter], actualReturn)
    return floatingPromiseCallApplicable
  }
  if floatingPromiseTypeContainsAnyTypeParameter(checker, expectedReturn, typeParameters, call.Expression, nil) {
    return floatingPromiseCallUncertain
  }
  if expectedReturn.Flags()&shimchecker.TypeFlagsVoid != 0 {
    return floatingPromiseCallApplicable
  }
  if returnNeedsContext {
    return floatingPromiseCallUncertain
  }
  if checker.IsTypeAssignableTo(actualReturn, expectedReturn) {
    return floatingPromiseCallApplicable
  }
  if implicitReturn || checker.IsContextSensitive(argument) {
    // The cached argument type belongs to the original call's contextual
    // signature. A different overload candidate can supply a different return
    // context (for example, string versus a string literal), so that cached
    // mismatch cannot prove the candidate is inapplicable.
    return floatingPromiseCallUncertain
  }
  return floatingPromiseCallIncompatible
}

func floatingPromiseSymbolHasNonPublicDeclaration(symbol *shimast.Symbol) bool {
  if symbol == nil {
    return false
  }
  hasNonPublicModifier := func(declaration *shimast.Node) bool {
    return declaration != nil &&
      declaration.ModifierFlags()&(shimast.ModifierFlagsPrivate|shimast.ModifierFlagsProtected) != 0
  }
  if hasNonPublicModifier(symbol.ValueDeclaration) {
    return true
  }
  for _, declaration := range symbol.Declarations {
    if hasNonPublicModifier(declaration) {
      return true
    }
  }
  return false
}

func floatingPromiseTypeParameterCandidateApplicability(
  checker *shimchecker.Checker,
  typeParameter *shimchecker.Type,
  candidate *shimchecker.Type,
  typeParameters []*shimchecker.Type,
  location *shimast.Node,
) floatingPromiseCallApplicability {
  if checker == nil || typeParameter == nil || candidate == nil {
    return floatingPromiseCallUncertain
  }
  constraint := checker.GetConstraintOfTypeParameter(typeParameter)
  if constraint == nil || constraint == typeParameter {
    return floatingPromiseCallApplicable
  }
  if floatingPromiseTypeContainsAnyTypeParameter(checker, constraint, typeParameters, location, nil) {
    return floatingPromiseCallUncertain
  }
  if checker.IsTypeAssignableTo(candidate, constraint) {
    return floatingPromiseCallApplicable
  }
  return floatingPromiseCallIncompatible
}

func floatingPromiseTypeParameterIndex(typeParameters []*shimchecker.Type, candidate *shimchecker.Type) int {
  for index, typeParameter := range typeParameters {
    if candidate == typeParameter {
      return index
    }
  }
  return -1
}

func floatingPromiseInferencesHaveWitness(checker *shimchecker.Checker, inferred []*shimchecker.Type) bool {
  for _, witness := range inferred {
    if witness == nil {
      continue
    }
    acceptsAll := true
    for _, candidate := range inferred {
      if candidate == nil || !checker.IsTypeAssignableTo(candidate, witness) {
        acceptsAll = false
        break
      }
    }
    if acceptsAll {
      return true
    }
  }
  return false
}

func floatingPromiseTypeContainsOpaqueMappedObject(
  checker *shimchecker.Checker,
  t *shimchecker.Type,
  visited map[*shimchecker.Type]bool,
) bool {
  if checker == nil || t == nil {
    return false
  }
  if visited == nil {
    visited = make(map[*shimchecker.Type]bool)
  }
  if visited[t] {
    return false
  }
  visited[t] = true
  if t.Flags()&shimchecker.TypeFlagsObject != 0 &&
    t.ObjectFlags()&(shimchecker.ObjectFlagsMapped|shimchecker.ObjectFlagsReverseMapped) != 0 {
    return true
  }
  if t.Flags()&shimchecker.TypeFlagsUnionOrIntersection != 0 {
    for _, part := range t.Types() {
      if floatingPromiseTypeContainsOpaqueMappedObject(checker, part, visited) {
        return true
      }
    }
  }
  if t.Flags()&shimchecker.TypeFlagsObject != 0 && t.ObjectFlags()&shimchecker.ObjectFlagsReference != 0 {
    for _, typeArgument := range checker.GetTypeArguments(t) {
      if floatingPromiseTypeContainsOpaqueMappedObject(checker, typeArgument, visited) {
        return true
      }
    }
  }
  return false
}

func floatingPromiseTypeContainsAnyTypeParameter(
  checker *shimchecker.Checker,
  t *shimchecker.Type,
  typeParameters []*shimchecker.Type,
  location *shimast.Node,
  visited map[*shimchecker.Type]bool,
) bool {
  if checker == nil || t == nil {
    return true
  }
  if floatingPromiseTypeParameterIndex(typeParameters, t) >= 0 ||
    t.Flags()&shimchecker.TypeFlagsTypeParameter != 0 {
    return true
  }
  if visited == nil {
    visited = make(map[*shimchecker.Type]bool)
  }
  if visited[t] {
    return false
  }
  visited[t] = true
  if t.Flags()&shimchecker.TypeFlagsObject != 0 &&
    t.ObjectFlags()&(shimchecker.ObjectFlagsMapped|shimchecker.ObjectFlagsReverseMapped) != 0 {
    return true
  }

  if t.Flags()&shimchecker.TypeFlagsUnionOrIntersection != 0 {
    for _, part := range t.Types() {
      if floatingPromiseTypeContainsAnyTypeParameter(checker, part, typeParameters, location, visited) {
        return true
      }
    }
  }
  if t.Flags()&shimchecker.TypeFlagsObject != 0 && t.ObjectFlags()&shimchecker.ObjectFlagsReference != 0 {
    for _, typeArgument := range checker.GetTypeArguments(t) {
      if floatingPromiseTypeContainsAnyTypeParameter(checker, typeArgument, typeParameters, location, visited) {
        return true
      }
    }
  }
  if t.Flags()&(shimchecker.TypeFlagsConditional|
    shimchecker.TypeFlagsIndex|
    shimchecker.TypeFlagsIndexedAccess|
    shimchecker.TypeFlagsSubstitution|
    shimchecker.TypeFlagsStringMapping|
    shimchecker.TypeFlagsTemplateLiteral) != 0 {
    return true
  }
  for _, kind := range []shimchecker.SignatureKind{
    shimchecker.SignatureKindCall,
    shimchecker.SignatureKindConstruct,
  } {
    for _, signature := range checker.GetSignaturesOfType(t, kind) {
      if len(signature.TypeParameters()) != 0 {
        return true
      }
      for index := range signature.Parameters() {
        parameterType := floatingPromiseSignatureParameterType(checker, signature, index, location)
        if parameterType == nil ||
          floatingPromiseTypeContainsAnyTypeParameter(checker, parameterType, typeParameters, location, visited) {
          return true
        }
      }
      if returnType := checker.GetReturnTypeOfSignature(signature); returnType == nil ||
        floatingPromiseTypeContainsAnyTypeParameter(checker, returnType, typeParameters, location, visited) {
        return true
      }
    }
  }
  if t.Flags()&shimchecker.TypeFlagsObject != 0 {
    for _, property := range shimchecker.Checker_getPropertiesOfType(checker, t) {
      propertyType := checker.GetTypeOfSymbolAtLocation(property, location)
      if propertyType == nil ||
        floatingPromiseTypeContainsAnyTypeParameter(checker, propertyType, typeParameters, location, visited) {
        return true
      }
    }
    for _, indexInfo := range checker.GetIndexInfosOfType(t) {
      if indexInfo == nil ||
        floatingPromiseTypeContainsAnyTypeParameter(checker, indexInfo.KeyType(), typeParameters, location, visited) ||
        floatingPromiseTypeContainsAnyTypeParameter(checker, indexInfo.ValueType(), typeParameters, location, visited) {
        return true
      }
    }
  }
  return false
}

func floatingPromiseFunctionArgument(node *shimast.Node) bool {
  node = unwrapFloatingPromiseExpression(node)
  return node != nil && (node.Kind == shimast.KindArrowFunction || node.Kind == shimast.KindFunctionExpression)
}

// floatingPromiseExpressionNeedsCandidateContext reports expression shapes
// whose type or validity can change when TypeScript rechecks them against an
// overload parameter. Checker.IsContextSensitive has a narrower purpose: it
// tracks nested untyped functions for inference and therefore returns false for
// ordinary object and array literals. Candidate context also flows through
// await/non-null wrappers, template expressions, and generic call return
// inference. Treat those paths as uncertain instead of comparing a type cached
// under the canonical call's different overload.
func floatingPromiseExpressionNeedsCandidateContext(
  checker *shimchecker.Checker,
  node *shimast.Node,
) bool {
  node = unwrapFloatingPromiseExpression(node)
  if node == nil {
    return true
  }
  switch node.Kind {
  case shimast.KindObjectLiteralExpression,
    shimast.KindArrayLiteralExpression,
    shimast.KindConditionalExpression,
    shimast.KindTemplateExpression:
    return true
  case shimast.KindAwaitExpression,
    shimast.KindNonNullExpression,
    shimast.KindYieldExpression:
    return floatingPromiseExpressionChildNeedsCandidateContext(checker, node.Expression())
  case shimast.KindAsExpression,
    shimast.KindTypeAssertionExpression:
    return shimast.IsConstAssertion(node)
  case shimast.KindCallExpression,
    shimast.KindNewExpression,
    shimast.KindTaggedTemplateExpression:
    return floatingPromiseCallNeedsCandidateContext(checker, node)
  case shimast.KindBinaryExpression:
    binary := node.AsBinaryExpression()
    if binary == nil || binary.OperatorToken == nil {
      return true
    }
    switch binary.OperatorToken.Kind {
    case shimast.KindAmpersandAmpersandToken,
      shimast.KindBarBarToken,
      shimast.KindQuestionQuestionToken,
      shimast.KindCommaToken:
      return true
    }
  }
  return false
}

func floatingPromiseExpressionChildNeedsCandidateContext(
  checker *shimchecker.Checker,
  node *shimast.Node,
) bool {
  node = unwrapFloatingPromiseExpression(node)
  return floatingPromiseFunctionArgument(node) ||
    floatingPromiseExpressionNeedsCandidateContext(checker, node)
}

func floatingPromiseCallNeedsCandidateContext(
  checker *shimchecker.Checker,
  node *shimast.Node,
) bool {
  if checker == nil || node == nil {
    return true
  }
  var callee *shimast.Node
  if node.Kind == shimast.KindTaggedTemplateExpression {
    tagged := node.AsTaggedTemplateExpression()
    if tagged != nil {
      callee = tagged.Tag
    }
  } else {
    callee = node.Expression()
  }
  if callee == nil {
    return true
  }
  calleeType := checker.GetTypeAtLocation(callee)
  if calleeType == nil {
    return true
  }
  signatureKind := shimchecker.SignatureKindCall
  if node.Kind == shimast.KindNewExpression {
    signatureKind = shimchecker.SignatureKindConstruct
  }
  sawSignature := false
  for _, part := range promiseUnionParts(calleeType) {
    apparent := checker.GetApparentType(part)
    if apparent == nil {
      return true
    }
    for _, signature := range checker.GetSignaturesOfType(apparent, signatureKind) {
      if signature == nil {
        return true
      }
      sawSignature = true
      target := signature.Target()
      if len(signature.TypeParameters()) != 0 ||
        target != nil && len(target.TypeParameters()) != 0 {
        return true
      }
    }
  }
  return !sawSignature
}

func floatingPromiseFunctionHasImplicitReturnType(node *shimast.Node) bool {
  node = unwrapFloatingPromiseExpression(node)
  return floatingPromiseFunctionArgument(node) && node.Type() == nil
}

func floatingPromiseFunctionReturnNeedsCandidateContext(
  checker *shimchecker.Checker,
  node *shimast.Node,
) bool {
  node = unwrapFloatingPromiseExpression(node)
  if !floatingPromiseFunctionHasImplicitReturnType(node) {
    return false
  }
  if node.Kind == shimast.KindFunctionExpression {
    expression := node.AsFunctionExpression()
    if expression == nil || expression.AsteriskToken != nil {
      return true
    }
  }
  body := node.Body()
  if body == nil {
    return true
  }
  if body.Kind != shimast.KindBlock {
    return floatingPromiseExpressionNeedsCandidateContext(checker, body)
  }
  needsContext := false
  walkConsistentReturnBody(body, func(statement *shimast.Node) {
    if needsContext || statement == nil {
      return
    }
    if expression := statement.Expression(); expression != nil &&
      floatingPromiseExpressionNeedsCandidateContext(checker, expression) {
      needsContext = true
    }
  })
  return needsContext
}

func floatingPromiseTypeMayAcceptFunction(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  if checker == nil || t == nil {
    return false
  }
  if t.Flags()&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown) != 0 {
    return true
  }
  for _, part := range promiseUnionParts(t) {
    if part == nil {
      continue
    }
    apparent := checker.GetApparentType(part)
    if apparent != nil && len(checker.GetSignaturesOfType(apparent, shimchecker.SignatureKindCall)) != 0 {
      return true
    }
  }
  return false
}

func floatingPromiseParameterType(
  checker *shimchecker.Checker,
  call *shimast.CallExpression,
  signature *shimchecker.Signature,
  index int,
) *shimchecker.Type {
  if checker == nil || call == nil || signature == nil || index < 0 {
    return nil
  }
  return floatingPromiseSignatureParameterType(checker, signature, index, call.Expression)
}

func floatingPromiseSignatureParameterType(
  checker *shimchecker.Checker,
  signature *shimchecker.Signature,
  index int,
  location *shimast.Node,
) *shimchecker.Type {
  if checker == nil || signature == nil || index < 0 || location == nil {
    return nil
  }
  parameters := signature.Parameters()
  if len(parameters) == 0 {
    return nil
  }
  parameterIndex := index
  if parameterIndex >= len(parameters) {
    if !signature.HasRestParameter() {
      return nil
    }
    parameterIndex = len(parameters) - 1
  }
  parameterType := checker.GetTypeOfSymbolAtLocation(parameters[parameterIndex], location)
  if parameterType == nil {
    return nil
  }
  if signature.HasRestParameter() && parameterIndex == len(parameters)-1 && index >= parameterIndex {
    if elementType := checker.GetNumberIndexType(parameterType); elementType != nil {
      return elementType
    }
  }
  return parameterType
}

func floatingPromiseSignatureIsJavaScript(signature *shimchecker.Signature) bool {
  if signature == nil {
    return false
  }
  declaration := signature.Declaration()
  return declaration != nil && declaration.Flags&shimast.NodeFlagsJavaScriptFile != 0
}

// floatingPromiseSignatureReturnIsUnhandled proves the selected declaration's
// return is safe without instantiating a signature through private Checker
// machinery. Concrete returns use the ordinary Promise classifiers. A naked
// method type parameter is accepted only when an explicit type argument or a
// directly corresponding value/callback return supplies every inferred type;
// all other generic shapes are conservatively unhandled.
func floatingPromiseSignatureReturnIsUnhandled(
  ctx *Context,
  node *shimast.Node,
  call *shimast.CallExpression,
  signature *shimchecker.Signature,
  options noFloatingPromisesOptions,
) bool {
  returnType := ctx.Checker.GetReturnTypeOfSignature(signature)
  if returnType == nil {
    return true
  }
  typeParameters := signature.TypeParameters()
  if len(typeParameters) == 0 {
    return floatingPromiseInferenceIsUncertain(returnType, nil) ||
      isFloatingPromiseType(ctx, node, returnType, options) ||
      isFloatingPromiseArray(ctx, node, returnType, options)
  }
  for index, typeParameter := range typeParameters {
    if returnType != typeParameter {
      continue
    }
    inferred := floatingPromiseNakedReturnInferences(ctx.Checker, call, signature, typeParameter, index)
    if len(inferred) == 0 {
      return true
    }
    for _, inferredType := range inferred {
      if floatingPromiseInferenceIsUncertain(inferredType, nil) ||
        floatingPromiseTypeContainsAnyTypeParameter(ctx.Checker, inferredType, nil, node, nil) ||
        isFloatingPromiseType(ctx, node, inferredType, options) ||
        isFloatingPromiseArray(ctx, node, inferredType, options) {
        return true
      }
    }
    return false
  }
  // Resolving a nested generic return (for example Container<T>) correctly
  // requires TypeScript's full inference mapper. With no public candidate-set
  // API, treating that shape as safe would hide a possible Promise.
  return true
}

func floatingPromiseInferenceIsUncertain(
  t *shimchecker.Type,
  visited map[*shimchecker.Type]bool,
) bool {
  if t == nil {
    return true
  }
  if t.Flags()&(shimchecker.TypeFlagsAny|
    shimchecker.TypeFlagsUnknown|
    shimchecker.TypeFlagsTypeParameter|
    shimchecker.TypeFlagsConditional|
    shimchecker.TypeFlagsIndexedAccess|
    shimchecker.TypeFlagsSubstitution) != 0 {
    return true
  }
  if t.Flags()&shimchecker.TypeFlagsUnionOrIntersection == 0 {
    return false
  }
  if visited == nil {
    visited = make(map[*shimchecker.Type]bool)
  }
  if visited[t] {
    return false
  }
  visited[t] = true
  for _, part := range t.Types() {
    if floatingPromiseInferenceIsUncertain(part, visited) {
      return true
    }
  }
  return false
}

func floatingPromiseNakedReturnInferences(
  checker *shimchecker.Checker,
  call *shimast.CallExpression,
  signature *shimchecker.Signature,
  typeParameter *shimchecker.Type,
  typeParameterIndex int,
) []*shimchecker.Type {
  if checker == nil || call == nil || signature == nil || typeParameter == nil {
    return nil
  }
  typeArguments := call.AsNode().TypeArguments()
  if len(typeArguments) != 0 {
    provided := make([]*shimchecker.Type, len(typeArguments))
    for index, typeArgument := range typeArguments {
      if typeArgument == nil {
        return nil
      }
      provided[index] = checker.GetTypeFromTypeNode(typeArgument)
      if provided[index] == nil {
        return nil
      }
    }
    filled := checker.FillMissingTypeArguments(
      provided,
      signature.TypeParameters(),
      checker.GetMinTypeArgumentCount(signature.TypeParameters()),
      floatingPromiseSignatureIsJavaScript(signature),
    )
    if typeParameterIndex < 0 || typeParameterIndex >= len(filled) {
      return nil
    }
    return []*shimchecker.Type{filled[typeParameterIndex]}
  }
  if call.Arguments == nil {
    return nil
  }
  var inferred []*shimchecker.Type
  for index, argument := range call.Arguments.Nodes {
    if argument == nil || argument.Kind == shimast.KindSpreadElement {
      return nil
    }
    parameterType := floatingPromiseParameterType(checker, call, signature, index)
    argumentType := checker.GetTypeAtLocation(argument)
    if parameterType == nil || argumentType == nil {
      return nil
    }
    if parameterType == typeParameter {
      if !floatingPromiseTypeParameterAccepts(checker, typeParameter, argumentType) {
        return nil
      }
      inferred = append(inferred, argumentType)
      continue
    }
    for _, parameterPart := range promiseUnionParts(parameterType) {
      for _, parameterSignature := range checker.GetSignaturesOfType(parameterPart, shimchecker.SignatureKindCall) {
        if checker.GetReturnTypeOfSignature(parameterSignature) != typeParameter {
          continue
        }
        for _, argumentPart := range promiseUnionParts(argumentType) {
          for _, argumentSignature := range checker.GetSignaturesOfType(argumentPart, shimchecker.SignatureKindCall) {
            if actualReturn := checker.GetReturnTypeOfSignature(argumentSignature); actualReturn != nil {
              if !floatingPromiseTypeParameterAccepts(checker, typeParameter, actualReturn) {
                return nil
              }
              inferred = append(inferred, actualReturn)
            }
          }
        }
      }
    }
  }
  if len(inferred) == 0 {
    defaultType := checker.GetDefaultFromTypeParameter(typeParameter)
    if defaultType != nil && !floatingPromiseTypeContainsAnyTypeParameter(
      checker,
      defaultType,
      signature.TypeParameters(),
      call.Expression,
      nil,
    ) && floatingPromiseTypeParameterAccepts(checker, typeParameter, defaultType) {
      return []*shimchecker.Type{defaultType}
    }
  }
  return inferred
}

func floatingPromiseTypeParameterAccepts(
  checker *shimchecker.Checker,
  typeParameter *shimchecker.Type,
  inferred *shimchecker.Type,
) bool {
  if checker == nil || typeParameter == nil || inferred == nil {
    return false
  }
  constraint := checker.GetConstraintOfTypeParameter(typeParameter)
  return constraint == nil || constraint == typeParameter || checker.IsTypeAssignableTo(inferred, constraint)
}

func floatingPromisePropertyAccessParts(node *shimast.Node) (*shimast.Node, string, bool) {
  node = stripParens(node)
  if node == nil {
    return nil, "", false
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return nil, "", false
    }
    method := identifierText(access.Name())
    return access.Expression, method, method != ""
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    if access == nil || access.ArgumentExpression == nil {
      return nil, "", false
    }
    switch access.ArgumentExpression.Kind {
    case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
      method := stringLiteralText(access.ArgumentExpression)
      return access.Expression, method, method != ""
    }
  }
  return nil, "", false
}

func isFloatingPromiseType(
  ctx *Context,
  location *shimast.Node,
  t *shimchecker.Type,
  options noFloatingPromisesOptions,
) bool {
  if t == nil {
    return false
  }
  apparent := ctx.Checker.GetApparentType(t)
  if apparent == nil {
    return false
  }
  for _, part := range promiseUnionParts(apparent) {
    if part == nil || typeMatchesSomePromiseSpecifier(ctx, part, options.AllowForKnownSafePromises) {
      continue
    }
    if isNativePromiseInstanceLike(ctx.Checker, part) {
      return true
    }
    if options.CheckThenables && isCatchableThenableAtLocation(ctx.Checker, location, part) {
      return true
    }
  }
  return false
}

func isCatchableThenableAtLocation(
  checker *shimchecker.Checker,
  location *shimast.Node,
  t *shimchecker.Type,
) bool {
  if checker == nil || t == nil {
    return false
  }
  apparent := checker.GetApparentType(t)
  if apparent == nil {
    return false
  }
  for _, part := range promiseUnionParts(apparent) {
    thenProperty := checker.GetPropertyOfType(part, "then")
    if thenProperty == nil {
      continue
    }
    thenType := checker.GetTypeOfSymbolAtLocation(thenProperty, location)
    for _, thenPart := range promiseUnionParts(thenType) {
      if thenPart == nil {
        continue
      }
      for _, signature := range checker.GetSignaturesOfType(thenPart, shimchecker.SignatureKindCall) {
        parameters := signature.Parameters()
        if len(parameters) >= 2 &&
          isCallableCallbackParameter(checker, location, parameters[0]) &&
          isCallableCallbackParameter(checker, location, parameters[1]) {
          return true
        }
      }
    }
  }
  return false
}

func isFloatingPromiseArray(
  ctx *Context,
  location *shimast.Node,
  t *shimchecker.Type,
  options noFloatingPromisesOptions,
) bool {
  for _, part := range promiseUnionParts(t) {
    apparent := ctx.Checker.GetApparentType(part)
    if apparent == nil {
      continue
    }
    if shimchecker.Checker_isArrayType(ctx.Checker, apparent) {
      arguments := ctx.Checker.GetTypeArguments(apparent)
      if len(arguments) > 0 && isFloatingPromiseType(ctx, location, arguments[0], options) {
        return true
      }
    }
    if shimchecker.IsTupleType(apparent) {
      for _, element := range ctx.Checker.GetTypeArguments(apparent) {
        if isFloatingPromiseType(ctx, location, element, options) {
          return true
        }
      }
    }
  }
  return false
}

func isNativePromiseInstanceLike(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  return isNativePromiseInstanceLikeSeen(checker, t, map[*shimchecker.Type]struct{}{})
}

func isNativePromiseInstanceLikeSeen(
  checker *shimchecker.Checker,
  t *shimchecker.Type,
  seen map[*shimchecker.Type]struct{},
) bool {
  if checker == nil || t == nil {
    return false
  }
  if _, ok := seen[t]; ok {
    return false
  }
  seen[t] = struct{}{}
  defer delete(seen, t)

  flags := t.Flags()
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if isNativePromiseInstanceLikeSeen(checker, part, seen) {
        return true
      }
    }
    return false
  }
  if flags&shimchecker.TypeFlagsTypeParameter != 0 {
    return isNativePromiseInstanceLikeSeen(checker, checker.GetBaseConstraintOfType(t), seen)
  }

  symbol := t.Symbol()
  if symbol == nil {
    return false
  }
  if symbol.Name == "Promise" && checker.IsLibSymbolForHoverVerbosity(symbol) {
    return true
  }
  declared := checker.GetDeclaredTypeOfSymbol(symbol)
  if declared == nil || declared.ObjectFlags()&shimchecker.ObjectFlagsClassOrInterface == 0 {
    return false
  }
  for _, base := range checker.GetBaseTypes(declared) {
    if isNativePromiseInstanceLikeSeen(checker, base, seen) {
      return true
    }
  }
  return false
}

func isKnownSafePromiseCall(
  ctx *Context,
  node *shimast.Node,
  specifiers []promiseTypeOrValueSpecifier,
) bool {
  if node == nil || node.Kind != shimast.KindCallExpression || len(specifiers) == 0 {
    return false
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return false
  }
  callee := unwrapFloatingPromiseExpression(call.Expression)
  if callee == nil {
    return false
  }
  if valueMatchesSomePromiseSpecifier(ctx, callee, specifiers) {
    return true
  }
  return typeMatchesSomePromiseSpecifier(ctx, ctx.Checker.GetTypeAtLocation(callee), specifiers)
}

func valueMatchesSomePromiseSpecifier(
  ctx *Context,
  node *shimast.Node,
  specifiers []promiseTypeOrValueSpecifier,
) bool {
  staticName, symbol := promiseValueNameAndSymbol(ctx.Checker, node)
  for _, specifier := range specifiers {
    if promiseSpecifierMatchesSymbol(ctx, specifier, staticName, symbol) {
      return true
    }
  }
  return false
}

func promiseValueNameAndSymbol(
  checker *shimchecker.Checker,
  node *shimast.Node,
) (string, *shimast.Symbol) {
  if checker == nil || node == nil {
    return "", nil
  }
  node = unwrapFloatingPromiseExpression(node)
  if node == nil {
    return "", nil
  }
  var nameNode *shimast.Node
  var staticName string
  switch node.Kind {
  case shimast.KindIdentifier:
    nameNode = node
    staticName = identifierText(node)
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access != nil {
      nameNode = access.Name()
      staticName = identifierText(nameNode)
    }
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    if access != nil && access.ArgumentExpression != nil {
      switch access.ArgumentExpression.Kind {
      case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
        staticName = stringLiteralText(access.ArgumentExpression)
      }
      receiverType := checker.GetTypeAtLocation(access.Expression)
      if receiverType != nil && staticName != "" {
        return staticName, checker.GetPropertyOfType(receiverType, staticName)
      }
    }
  }
  symbol := checker.GetSymbolAtLocation(nameNode)
  if symbol != nil && symbol.Flags&shimast.SymbolFlagsAlias != 0 {
    symbol = checker.GetAliasedSymbol(symbol)
  }
  return staticName, symbol
}

func typeMatchesSomePromiseSpecifier(
  ctx *Context,
  t *shimchecker.Type,
  specifiers []promiseTypeOrValueSpecifier,
) bool {
  for _, specifier := range specifiers {
    if typeMatchesPromiseSpecifier(ctx, t, specifier) {
      return true
    }
  }
  return false
}

func typeMatchesPromiseSpecifier(
  ctx *Context,
  t *shimchecker.Type,
  specifier promiseTypeOrValueSpecifier,
) bool {
  if ctx == nil || ctx.Checker == nil || t == nil {
    return false
  }
  if t.Flags()&shimchecker.TypeFlagsUnion != 0 {
    parts := t.Types()
    if len(parts) == 0 {
      return false
    }
    for _, part := range parts {
      if !typeMatchesPromiseSpecifier(ctx, part, specifier) {
        return false
      }
    }
    return true
  }

  symbol := shimchecker.Type_getTypeNameSymbol(t)
  if symbol == nil {
    symbol = t.Symbol()
  }
  if symbol != nil && symbol.Flags&shimast.SymbolFlagsAlias != 0 {
    symbol = ctx.Checker.GetAliasedSymbol(symbol)
  }
  if promiseSpecifierMatchesSymbol(ctx, specifier, "", symbol) {
    return true
  }
  if t.Flags()&shimchecker.TypeFlagsIntersection != 0 {
    for _, part := range t.Types() {
      if typeMatchesPromiseSpecifier(ctx, part, specifier) {
        return true
      }
    }
  }
  return false
}

func promiseSpecifierMatchesSymbol(
  ctx *Context,
  specifier promiseTypeOrValueSpecifier,
  staticName string,
  symbol *shimast.Symbol,
) bool {
  symbolName := ""
  if symbol != nil {
    symbolName = symbol.Name
  }
  if !promiseSpecifierNameMatches(specifier.Names, staticName, symbolName) {
    return false
  }
  if specifier.Universal {
    return true
  }
  switch specifier.From {
  case "file":
    return promiseSymbolDeclaredInFile(ctx, symbol, specifier.Path)
  case "lib":
    return symbol != nil && ctx.Checker.IsLibSymbolForHoverVerbosity(symbol)
  case "package":
    return promiseSymbolDeclaredInPackage(symbol, specifier.PackageName)
  default:
    return false
  }
}

func promiseSpecifierNameMatches(names []string, candidates ...string) bool {
  for _, name := range names {
    for _, candidate := range candidates {
      if name != "" && name == candidate {
        return true
      }
    }
  }
  return false
}

func promiseSymbolDeclaredInFile(ctx *Context, symbol *shimast.Symbol, configuredPath string) bool {
  if ctx == nil || ctx.File == nil || symbol == nil {
    return false
  }
  for _, declaration := range symbol.Declarations {
    source := sourceFileForPromiseDeclaration(declaration)
    if source == nil || ctx.Checker.IsLibSymbolForHoverVerbosity(symbol) {
      continue
    }
    if configuredPath == "" {
      if ctx.CurrentDirectory == "" || promisePathWithin(ctx.CurrentDirectory, source.FileName()) {
        return true
      }
      continue
    }
    if promiseDeclarationPathMatches(ctx.CurrentDirectory, source.FileName(), configuredPath) {
      return true
    }
  }
  return false
}

func promiseDeclarationPathMatches(currentDirectory, declarationFile, configuredPath string) bool {
  configuredPath = filepath.Clean(filepath.FromSlash(configuredPath))
  if !filepath.IsAbs(configuredPath) {
    configuredPath = filepath.Join(currentDirectory, configuredPath)
  }
  return promiseCanonicalPath(declarationFile) == promiseCanonicalPath(configuredPath)
}

func promisePathWithin(currentDirectory, declarationFile string) bool {
  root := promiseCanonicalPath(currentDirectory)
  declaration := promiseCanonicalPath(declarationFile)
  relative, err := filepath.Rel(root, declaration)
  if err != nil || filepath.IsAbs(relative) {
    return false
  }
  return relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

func promiseCanonicalPath(path string) string {
  path = filepath.Clean(path)
  if runtime.GOOS == "windows" {
    return strings.ToLower(path)
  }
  return path
}

func promiseSymbolDeclaredInPackage(symbol *shimast.Symbol, packageName string) bool {
  if symbol == nil || packageName == "" {
    return false
  }
  packagePath := "/node_modules/" + strings.Trim(packageName, "/") + "/"
  typesName := strings.TrimPrefix(packageName, "@")
  typesName = strings.Replace(typesName, "/", "__", 1)
  typesPath := "/node_modules/@types/" + typesName + "/"
  for _, declaration := range symbol.Declarations {
    for parent := declaration; parent != nil; parent = parent.Parent {
      if parent.Kind == shimast.KindModuleDeclaration {
        if name := parent.Name(); name != nil && stringLiteralText(name) == packageName {
          return true
        }
      }
      if parent.Kind == shimast.KindSourceFile {
        source := parent.AsSourceFile()
        if source == nil {
          break
        }
        fileName := "/" + strings.TrimLeft(filepath.ToSlash(source.FileName()), "/")
        if strings.Contains(fileName, packagePath) || strings.Contains(fileName, typesPath) {
          return true
        }
        break
      }
    }
  }
  return false
}

func sourceFileForPromiseDeclaration(node *shimast.Node) *shimast.SourceFile {
  for current := node; current != nil; current = current.Parent {
    if current.Kind == shimast.KindSourceFile {
      return current.AsSourceFile()
    }
  }
  return nil
}

func isImmediatelyInvokedFunctionExpression(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call == nil {
    return false
  }
  callee := unwrapFloatingPromiseExpression(call.Expression)
  return callee != nil && (callee.Kind == shimast.KindArrowFunction || callee.Kind == shimast.KindFunctionExpression)
}

func unwrapFloatingPromiseExpression(node *shimast.Node) *shimast.Node {
  for node != nil {
    switch node.Kind {
    case shimast.KindParenthesizedExpression,
      shimast.KindPartiallyEmittedExpression:
      next := node.Expression()
      if next == nil {
        return node
      }
      node = next
    default:
      return node
    }
  }
  return nil
}

// isPromiseTypedExpression reports whether `t` represents a Promise (or
// structurally callable thenable) under the older shared boolean policy used by
// the other Promise rules. no-floating-promises has its own option-aware native
// Promise and catchable-thenable boundary above. Unlike
// classifyPromiseAwaitability, `any`, `unknown`, and `never` are skipped because
// they cannot prove that a real Promise is present.
func isPromiseTypedExpression(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  if checker == nil || t == nil {
    return false
  }
  flags := t.Flags()
  if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
    return false
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if isPromiseTypedExpression(checker, part) {
        return true
      }
    }
    return false
  }
  if checker.GetPromisedTypeOfPromise(t) != nil {
    return true
  }
  return isThenableType(checker, t)
}

// returnAwait: `return promise;` inside try/catch/finally lets the rejection
// escape the surrounding handler instead of being observed by it. Awaiting the
// promise first (`return await promise;`) keeps the rejection inside the
// async function's microtask queue, so the enclosing `catch` or `finally` can
// see it. typescript-eslint recommended-type-checked:
// https://typescript-eslint.io/rules/return-await/
//
// Trigger condition (walks up from the return statement and stops at the
// nearest function boundary):
//
//   - the return is lexically inside a `try` block — fire;
//   - the return is lexically inside a `finally` block — fire;
//   - the return is lexically inside a `catch` block AND another
//     try/catch/finally context wraps that catch — fire.
//
// Returning a Promise from outside any handler is fine: the caller observes
// the rejection through its own await. The rule is type-aware: it consults
// `ctx.Checker.GetTypeAtLocation` and `GetPromisedTypeOfPromise` to skip
// non-Promise returns.
type returnAwait struct{}

func (returnAwait) Name() string { return "typescript/return-await" }
func (returnAwait) NeedsTypeChecker() bool {
  return true
}
func (returnAwait) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindReturnStatement}
}
func (returnAwait) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  ret := node.AsReturnStatement()
  if ret == nil || ret.Expression == nil {
    return
  }
  expr := stripParens(ret.Expression)
  if expr == nil {
    return
  }
  // Already `return await promise;` — author opted in.
  if expr.Kind == shimast.KindAwaitExpression {
    return
  }
  if !returnAwaitInsideHandler(node) {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(expr)
  if t == nil {
    return
  }
  if ctx.Checker.GetPromisedTypeOfPromise(t) == nil {
    return
  }
  ctx.Report(node, "Returning a Promise from a try/catch/finally block requires `await` so the surrounding handler observes the rejection.")
}

// returnAwaitInsideHandler walks the parent chain from `node` upward, stops at
// the nearest function boundary, and reports whether the return statement sits
// inside a try block, a finally block, or a catch block that is itself wrapped
// by another try/catch/finally context.
//
// The function boundary stop matches `walkToFinally` in rules_finally: a return
// inside a nested function targets that inner function, so it cannot escape
// the outer try/catch/finally and must not trip the rule.
func returnAwaitInsideHandler(node *shimast.Node) bool {
  cur := node.Parent
  for cur != nil {
    if isFunctionLikeKind(cur) || cur.Kind == shimast.KindSourceFile {
      return false
    }
    if cur.Kind == shimast.KindBlock {
      grand := cur.Parent
      if grand != nil && grand.Kind == shimast.KindTryStatement {
        try := grand.AsTryStatement()
        if try != nil {
          if try.TryBlock == cur {
            return true
          }
          if try.FinallyBlock == cur {
            return true
          }
        }
      }
    }
    if cur.Kind == shimast.KindCatchClause {
      // Inside a catch: only fires when another try/catch/finally
      // wraps this one so the rejection can be re-observed.
      if hasEnclosingTryContext(cur.Parent) {
        return true
      }
    }
    cur = cur.Parent
  }
  return false
}

// hasEnclosingTryContext walks upward from `node` and reports whether the path
// to the nearest function boundary crosses any try block, catch clause, or
// finally block. Used by the catch-clause arm of returnAwaitInsideHandler to
// decide whether the catch is itself wrapped by another handler.
func hasEnclosingTryContext(node *shimast.Node) bool {
  for cur := node; cur != nil; cur = cur.Parent {
    if isFunctionLikeKind(cur) || cur.Kind == shimast.KindSourceFile {
      return false
    }
    if cur.Kind == shimast.KindBlock {
      grand := cur.Parent
      if grand != nil && grand.Kind == shimast.KindTryStatement {
        try := grand.AsTryStatement()
        if try != nil && (try.TryBlock == cur || try.FinallyBlock == cur) {
          return true
        }
      }
    }
    if cur.Kind == shimast.KindCatchClause {
      return true
    }
  }
  return false
}

// promise/param-names mirrors eslint-plugin-promise's constructor convention:
// inline executors should name their parameters resolve/reject (allowing a
// leading underscore for intentionally unused parameters).
type promiseParamNames struct{}

func (promiseParamNames) Name() string { return promiseRulePrefix + "param-names" }
func (promiseParamNames) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (promiseParamNames) Check(ctx *Context, node *shimast.Node) {
  executor := promiseExecutor(node)
  if executor == nil {
    return
  }
  params := executor.Parameters()
  if len(params) > 0 {
    name := parameterIdentifierName(params[0])
    if name != "" && name != "resolve" && name != "_resolve" {
      ctx.Report(params[0], "Promise constructor first parameter should be named resolve.")
    }
  }
  if len(params) > 1 {
    name := parameterIdentifierName(params[1])
    if name != "" && name != "reject" && name != "_reject" {
      ctx.Report(params[1], "Promise constructor second parameter should be named reject.")
    }
  }
}

type promiseAvoidNew struct{}

func (promiseAvoidNew) Name() string { return promiseRulePrefix + "avoid-new" }
func (promiseAvoidNew) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (promiseAvoidNew) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne != nil && identifierText(ne.Expression) == "Promise" {
    ctx.Report(node, "Avoid creating new promises directly.")
  }
}

type promiseNoNewStatics struct{}

func (promiseNoNewStatics) Name() string { return promiseRulePrefix + "no-new-statics" }
func (promiseNoNewStatics) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (promiseNoNewStatics) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne == nil {
    return
  }
  method, ok := promiseStaticMethod(ne.Expression)
  if ok {
    ctx.Report(node, "Avoid calling new on Promise."+method+"().")
  }
}

type promiseValidParams struct{}

func (promiseValidParams) Name() string { return promiseRulePrefix + "valid-params" }
func (promiseValidParams) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (promiseValidParams) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Arguments == nil {
    return
  }
  _, method, ok := promiseCallMethod(call)
  if !ok {
    return
  }
  count := len(call.Arguments.Nodes)
  switch method {
  case "resolve", "reject":
    if count > 1 {
      ctx.Report(node, "Promise."+method+"() accepts at most one argument.")
    }
  case "then":
    if count < 1 || count > 2 {
      ctx.Report(node, "Promise then() expects one or two arguments.")
    }
  case "race", "all", "allSettled", "any", "catch", "finally":
    if count != 1 {
      ctx.Report(node, "Promise "+method+"() expects exactly one argument.")
    }
  }
}

type promiseSpecOnly struct{}

func (promiseSpecOnly) Name() string { return promiseRulePrefix + "spec-only" }
func (promiseSpecOnly) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (promiseSpecOnly) Check(ctx *Context, node *shimast.Node) {
  obj, prop, ok := promisePropertyAccessParts(node)
  if !ok {
    return
  }
  if identifierText(obj) == "Promise" {
    if prop == "prototype" {
      return
    }
    if !isPromiseStaticMethod(prop) {
      ctx.Report(node, "Avoid using non-standard Promise."+prop+".")
    }
    return
  }
  base, baseProp, baseOK := promisePropertyAccessParts(obj)
  if baseOK && identifierText(base) == "Promise" && baseProp == "prototype" && !isPromiseInstanceMethod(prop) {
    ctx.Report(node, "Avoid using non-standard Promise.prototype."+prop+".")
  }
}

type promiseNoNative struct{}

func (promiseNoNative) Name() string { return promiseRulePrefix + "no-native" }
func (promiseNoNative) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (promiseNoNative) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil || fileDeclaresPromise(node) {
    return
  }
  reported := false
  walkDescendants(node, func(child *shimast.Node) {
    if reported || child == nil {
      return
    }
    switch child.Kind {
    case shimast.KindNewExpression:
      ne := child.AsNewExpression()
      if ne != nil && identifierText(ne.Expression) == "Promise" {
        reported = true
        ctx.Report(ne.Expression, "\"Promise\" is not defined in ES5 environments.")
      }
    case shimast.KindPropertyAccessExpression:
      obj, _, ok := promisePropertyAccessParts(child)
      if ok && identifierText(obj) == "Promise" {
        reported = true
        ctx.Report(obj, "\"Promise\" is not defined in ES5 environments.")
      }
    }
  })
}

type promisePreferAwaitToThen struct{}

func (promisePreferAwaitToThen) Name() string { return promiseRulePrefix + "prefer-await-to-then" }
func (promisePreferAwaitToThen) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (promisePreferAwaitToThen) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  _, method, ok := promiseCallMethod(call)
  if ok && isPromiseInstanceMethod(method) {
    ctx.Report(node, "Prefer async/await to promise "+method+"() chains.")
  }
}

type promisePreferCatch struct{}

func (promisePreferCatch) Name() string { return promiseRulePrefix + "prefer-catch" }
func (promisePreferCatch) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (promisePreferCatch) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  _, method, ok := promiseCallMethod(call)
  if !ok || method != "then" || call.Arguments == nil || len(call.Arguments.Nodes) < 2 {
    return
  }
  ctx.Report(call.Arguments.Nodes[1], "Prefer catch() to passing a rejection handler to then().")
}

type promiseCatchOrReturn struct{}

func (promiseCatchOrReturn) Name() string { return promiseRulePrefix + "catch-or-return" }
func (promiseCatchOrReturn) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindExpressionStatement}
}
func (promiseCatchOrReturn) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsExpressionStatement()
  if stmt == nil || stmt.Expression == nil {
    return
  }
  if promiseChainHasMethod(stmt.Expression, "then") && !promiseChainHasMethod(stmt.Expression, "catch") {
    ctx.Report(node, "Promise chains should be returned or terminated with catch().")
  }
}

type promiseAlwaysReturn struct{}

func (promiseAlwaysReturn) Name() string { return promiseRulePrefix + "always-return" }
func (promiseAlwaysReturn) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (promiseAlwaysReturn) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  _, method, ok := promiseCallMethod(call)
  if !ok || method != "then" || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  callback := stripParens(call.Arguments.Nodes[0])
  if callback == nil || !isFunctionLikeKind(callback) {
    return
  }
  body := callback.Body()
  if body == nil || body.Kind != shimast.KindBlock {
    return
  }
  if !blockReturnsOrThrows(body) {
    ctx.Report(callback, "Each then() callback should return a value or throw.")
  }
}

type promiseNoReturnWrap struct{}

func (promiseNoReturnWrap) Name() string { return promiseRulePrefix + "no-return-wrap" }
func (promiseNoReturnWrap) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindReturnStatement, shimast.KindArrowFunction}
}
func (promiseNoReturnWrap) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindReturnStatement:
    ret := node.AsReturnStatement()
    if ret == nil || ret.Expression == nil || !isInsidePromiseCallbackFunction(node) {
      return
    }
    if method, ok := promiseResolveRejectCall(ret.Expression); ok {
      ctx.Report(ret.Expression, "Avoid wrapping return values in Promise."+method+"().")
    }
  case shimast.KindArrowFunction:
    arrow := node.AsArrowFunction()
    if arrow == nil || arrow.Body == nil || arrow.Body.Kind == shimast.KindBlock || !isPromiseCallbackFunction(node) {
      return
    }
    if method, ok := promiseResolveRejectCall(arrow.Body); ok {
      ctx.Report(arrow.Body, "Avoid wrapping return values in Promise."+method+"().")
    }
  }
}

type promiseNoReturnInFinally struct{}

func (promiseNoReturnInFinally) Name() string { return promiseRulePrefix + "no-return-in-finally" }
func (promiseNoReturnInFinally) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindReturnStatement}
}
func (promiseNoReturnInFinally) Check(ctx *Context, node *shimast.Node) {
  if fn := nearestFunctionLike(node); fn != nil && isPromiseCallbackFunctionFor(fn, "finally") {
    ctx.Report(node, "Do not return from a Promise finally() callback.")
  }
}

type promiseNoNesting struct{}

func (promiseNoNesting) Name() string { return promiseRulePrefix + "no-nesting" }
func (promiseNoNesting) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (promiseNoNesting) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  _, method, ok := promiseCallMethod(call)
  if !ok || (method != "then" && method != "catch") {
    return
  }
  if fn := nearestFunctionLike(node); fn != nil && isPromiseCallbackFunction(fn) {
    ctx.Report(node, "Avoid nesting promise callbacks.")
  }
}

type promiseNoCallbackInPromise struct{}

func (promiseNoCallbackInPromise) Name() string { return promiseRulePrefix + "no-callback-in-promise" }
func (promiseNoCallbackInPromise) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (promiseNoCallbackInPromise) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil {
    return
  }
  if isCallbackCall(call) {
    if fn := nearestFunctionLike(node); fn != nil && isPromiseCallbackFunction(fn) {
      ctx.Report(node, "Avoid calling callbacks inside promise callbacks.")
    }
    return
  }
  _, method, ok := promiseCallMethod(call)
  if !ok || (method != "then" && method != "catch") || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  first := stripParens(call.Arguments.Nodes[0])
  if first != nil && first.Kind == shimast.KindIdentifier && isCallbackName(identifierText(first)) {
    ctx.Report(first, "Avoid passing callbacks into promise chains.")
  }
}

type promiseNoPromiseInCallback struct{}

func (promiseNoPromiseInCallback) Name() string { return promiseRulePrefix + "no-promise-in-callback" }
func (promiseNoPromiseInCallback) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (promiseNoPromiseInCallback) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || !isPromiseLikeCall(call) || isDirectReturnValue(node) {
    return
  }
  if fn := nearestFunctionLike(node); fn != nil && isErrorFirstCallback(fn) {
    ctx.Report(call.Expression, "Avoid using promises inside callbacks.")
  }
}

type promisePreferAwaitToCallbacks struct{}

func (promisePreferAwaitToCallbacks) Name() string {
  return promiseRulePrefix + "prefer-await-to-callbacks"
}
func (promisePreferAwaitToCallbacks) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindCallExpression,
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
  }
}
func (promisePreferAwaitToCallbacks) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    if isCallbackCall(call) {
      ctx.Report(node, "Avoid callbacks. Prefer async/await.")
      return
    }
    if hasErrorFirstCallbackArgument(call) && !isInsideAwaitOrYield(node) {
      ctx.Report(node, "Avoid callbacks. Prefer async/await.")
    }
  default:
    params := node.Parameters()
    if len(params) == 0 {
      return
    }
    lastName := parameterIdentifierName(params[len(params)-1])
    if lastName == "callback" || lastName == "cb" {
      ctx.Report(params[len(params)-1], "Avoid callbacks. Prefer async/await.")
    }
  }
}

type promiseNoMultipleResolved struct{}

func (promiseNoMultipleResolved) Name() string { return promiseRulePrefix + "no-multiple-resolved" }
func (promiseNoMultipleResolved) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (promiseNoMultipleResolved) Check(ctx *Context, node *shimast.Node) {
  executor := promiseExecutor(node)
  if executor == nil {
    return
  }
  params := executor.Parameters()
  resolverNames := map[string]bool{}
  for i := 0; i < len(params) && i < 2; i++ {
    if name := parameterIdentifierName(params[i]); name != "" {
      resolverNames[name] = true
    }
  }
  if len(resolverNames) == 0 {
    return
  }
  count := 0
  walkFunctionBody(executor, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindCallExpression {
      return
    }
    call := child.AsCallExpression()
    if call == nil || !resolverNames[callCalleeName(call)] {
      return
    }
    count++
    if count > 1 {
      ctx.Report(child, "Promise should not be resolved multiple times.")
    }
  })
}

func promiseExecutor(node *shimast.Node) *shimast.Node {
  ne := node.AsNewExpression()
  if ne == nil || identifierText(ne.Expression) != "Promise" || ne.Arguments == nil || len(ne.Arguments.Nodes) == 0 {
    return nil
  }
  executor := stripParens(ne.Arguments.Nodes[0])
  if executor == nil || !isFunctionLikeKind(executor) {
    return nil
  }
  return executor
}

func parameterIdentifierName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  param := node.AsParameterDeclaration()
  if param == nil {
    return ""
  }
  return identifierText(param.Name())
}

func promisePropertyAccessParts(node *shimast.Node) (*shimast.Node, string, bool) {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return nil, "", false
  }
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return nil, "", false
  }
  prop := identifierText(access.Name())
  return access.Expression, prop, prop != ""
}

func promiseCallMethod(call *shimast.CallExpression) (*shimast.Node, string, bool) {
  if call == nil || call.Expression == nil {
    return nil, "", false
  }
  object, method, ok := promisePropertyAccessParts(call.Expression)
  if !ok {
    return nil, "", false
  }
  if identifierText(object) == "Promise" && !isPromiseStaticMethod(method) {
    return nil, "", false
  }
  return object, method, true
}

func promiseStaticMethod(node *shimast.Node) (string, bool) {
  object, method, ok := promisePropertyAccessParts(node)
  if !ok || identifierText(object) != "Promise" || !isPromiseStaticMethod(method) {
    return "", false
  }
  return method, true
}

func isPromiseStaticMethod(method string) bool {
  switch method {
  case "all", "allSettled", "any", "race", "reject", "resolve", "withResolvers":
    return true
  }
  return false
}

func isPromiseInstanceMethod(method string) bool {
  switch method {
  case "then", "catch", "finally":
    return true
  }
  return false
}

func isPromiseLikeCall(call *shimast.CallExpression) bool {
  object, method, ok := promiseCallMethod(call)
  if !ok {
    return false
  }
  if isPromiseInstanceMethod(method) {
    return true
  }
  return identifierText(object) == "Promise" && isPromiseStaticMethod(method)
}

func promiseChainHasMethod(node *shimast.Node, want string) bool {
  node = stripParens(node)
  for node != nil && node.Kind == shimast.KindCallExpression {
    call := node.AsCallExpression()
    object, method, ok := promiseCallMethod(call)
    if !ok {
      return false
    }
    if method == want {
      return true
    }
    node = object
  }
  return false
}

func promiseResolveRejectCall(node *shimast.Node) (string, bool) {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return "", false
  }
  call := node.AsCallExpression()
  object, method, ok := promiseCallMethod(call)
  if !ok || identifierText(object) != "Promise" || (method != "resolve" && method != "reject") {
    return "", false
  }
  return method, true
}

func nearestFunctionLike(node *shimast.Node) *shimast.Node {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if isFunctionLikeKind(cur) {
      return cur
    }
  }
  return nil
}

func isInsidePromiseCallbackFunction(node *shimast.Node) bool {
  if fn := nearestFunctionLike(node); fn != nil {
    return isPromiseCallbackFunction(fn)
  }
  return false
}

func isPromiseCallbackFunction(fn *shimast.Node) bool {
  return isPromiseCallbackFunctionFor(fn, "then") ||
    isPromiseCallbackFunctionFor(fn, "catch") ||
    isPromiseCallbackFunctionFor(fn, "finally")
}

func isPromiseCallbackFunctionFor(fn *shimast.Node, method string) bool {
  if fn == nil || !isFunctionLikeKind(fn) {
    return false
  }
  for parent := fn.Parent; parent != nil && parent.Kind == shimast.KindParenthesizedExpression; parent = parent.Parent {
    fn = parent
  }
  callNode := fn.Parent
  if callNode == nil || callNode.Kind != shimast.KindCallExpression {
    return false
  }
  call := callNode.AsCallExpression()
  if call == nil || call.Arguments == nil {
    return false
  }
  found := false
  for _, arg := range call.Arguments.Nodes {
    if stripParens(arg) == fn {
      found = true
      break
    }
  }
  if !found {
    return false
  }
  _, actual, ok := promiseCallMethod(call)
  return ok && actual == method
}

func blockReturnsOrThrows(block *shimast.Node) bool {
  if block == nil || block.Kind != shimast.KindBlock {
    return false
  }
  return statementsReturnOrThrow(block.Statements())
}

func statementsReturnOrThrow(statements []*shimast.Node) bool {
  for _, stmt := range statements {
    if statementReturnsOrThrows(stmt) {
      return true
    }
  }
  return false
}

func statementReturnsOrThrows(stmt *shimast.Node) bool {
  if stmt == nil {
    return false
  }
  switch stmt.Kind {
  case shimast.KindReturnStatement, shimast.KindThrowStatement:
    return true
  case shimast.KindBlock:
    return statementsReturnOrThrow(stmt.Statements())
  case shimast.KindIfStatement:
    ifStmt := stmt.AsIfStatement()
    if ifStmt == nil || ifStmt.ThenStatement == nil || ifStmt.ElseStatement == nil {
      return false
    }
    return statementReturnsOrThrows(ifStmt.ThenStatement) &&
      statementReturnsOrThrows(ifStmt.ElseStatement)
  case shimast.KindTryStatement:
    return tryStatementReturnsOrThrows(stmt)
  case shimast.KindSwitchStatement:
    return switchStatementReturnsOrThrows(stmt)
  case shimast.KindLabeledStatement:
    labeled := stmt.AsLabeledStatement()
    return labeled != nil && statementReturnsOrThrows(labeled.Statement)
  }
  return false
}

func tryStatementReturnsOrThrows(stmt *shimast.Node) bool {
  tryStmt := stmt.AsTryStatement()
  if tryStmt == nil {
    return false
  }
  if tryStmt.FinallyBlock != nil && statementsReturnOrThrow(tryStmt.FinallyBlock.Statements()) {
    return true
  }
  if tryStmt.TryBlock == nil || !statementsReturnOrThrow(tryStmt.TryBlock.Statements()) {
    return false
  }
  if tryStmt.CatchClause == nil {
    return true
  }
  catchClause := tryStmt.CatchClause.AsCatchClause()
  return catchClause != nil &&
    catchClause.Block != nil &&
    statementsReturnOrThrow(catchClause.Block.Statements())
}

func switchStatementReturnsOrThrows(stmt *shimast.Node) bool {
  switchStmt := stmt.AsSwitchStatement()
  if switchStmt == nil || switchStmt.CaseBlock == nil {
    return false
  }
  caseBlock := switchStmt.CaseBlock.AsCaseBlock()
  if caseBlock == nil || caseBlock.Clauses == nil {
    return false
  }
  clauses := caseBlock.Clauses.Nodes
  hasDefault := false
  for index, clauseNode := range clauses {
    if clauseNode == nil {
      return false
    }
    if clauseNode.Kind == shimast.KindDefaultClause {
      hasDefault = true
    }
    if !switchClauseEntryReturnsOrThrows(clauses[index:]) {
      return false
    }
  }
  return hasDefault
}

func switchClauseEntryReturnsOrThrows(clauses []*shimast.Node) bool {
  for _, clauseNode := range clauses {
    clause := clauseNode.AsCaseOrDefaultClause()
    if clause == nil || clause.Statements == nil {
      return false
    }
    if statementsReturnOrThrow(clause.Statements.Nodes) {
      return true
    }
  }
  return false
}

func walkFunctionBody(root *shimast.Node, visit func(*shimast.Node)) {
  if root == nil {
    return
  }
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil {
      return
    }
    if node != root && isFunctionLikeKind(node) {
      return
    }
    visit(node)
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(root)
}

func isCallbackName(name string) bool {
  switch name {
  case "callback", "cb", "next", "done":
    return true
  }
  return false
}

func isCallbackCall(call *shimast.CallExpression) bool {
  if call == nil {
    return false
  }
  if isCallbackName(callCalleeName(call)) {
    return true
  }
  return false
}

func isErrorFirstCallback(fn *shimast.Node) bool {
  if fn == nil || !isFunctionLikeKind(fn) || isPromiseCallbackFunction(fn) {
    return false
  }
  params := fn.Parameters()
  if len(params) == 0 {
    return false
  }
  switch parameterIdentifierName(params[0]) {
  case "err", "error":
    return true
  }
  return false
}

func hasErrorFirstCallbackArgument(call *shimast.CallExpression) bool {
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return false
  }
  last := stripParens(call.Arguments.Nodes[len(call.Arguments.Nodes)-1])
  if last == nil || !isFunctionLikeKind(last) || isArrayIterationCallback(call) {
    return false
  }
  params := last.Parameters()
  return len(params) > 0 && (parameterIdentifierName(params[0]) == "err" || parameterIdentifierName(params[0]) == "error")
}

func isArrayIterationCallback(call *shimast.CallExpression) bool {
  _, method, ok := promiseCallMethod(call)
  if !ok {
    return false
  }
  switch method {
  case "map", "every", "forEach", "some", "find", "filter", "on", "once":
    return true
  }
  return false
}

func isInsideAwaitOrYield(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindAwaitExpression || cur.Kind == shimast.KindYieldExpression {
      return true
    }
  }
  return false
}

func isDirectReturnValue(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil {
    return false
  }
  if parent.Kind == shimast.KindReturnStatement {
    return true
  }
  if parent.Kind == shimast.KindArrowFunction {
    arrow := parent.AsArrowFunction()
    return arrow != nil && arrow.Body == node
  }
  return false
}

func fileDeclaresPromise(file *shimast.Node) bool {
  declared := false
  walkDescendants(file, func(node *shimast.Node) {
    if declared || node == nil {
      return
    }
    switch node.Kind {
    case shimast.KindImportClause, shimast.KindImportSpecifier, shimast.KindNamespaceImport:
      if node.Name() != nil && identifierText(node.Name()) == "Promise" {
        declared = true
      }
    case shimast.KindVariableDeclaration, shimast.KindFunctionDeclaration, shimast.KindClassDeclaration, shimast.KindInterfaceDeclaration, shimast.KindTypeAliasDeclaration:
      if node.Name() != nil && identifierText(node.Name()) == "Promise" {
        declared = true
      }
    }
  })
  return declared
}

func init() {
  Register(awaitThenable{})
  Register(noFloatingPromises{})
  Register(returnAwait{})
  Register(promiseAlwaysReturn{})
  Register(promiseAvoidNew{})
  Register(promiseCatchOrReturn{})
  Register(promiseNoCallbackInPromise{})
  Register(promiseNoMultipleResolved{})
  Register(promiseNoNative{})
  Register(promiseNoNesting{})
  Register(promiseNoNewStatics{})
  Register(promiseNoPromiseInCallback{})
  Register(promiseNoReturnInFinally{})
  Register(promiseNoReturnWrap{})
  Register(promiseParamNames{})
  Register(promisePreferAwaitToCallbacks{})
  Register(promisePreferAwaitToThen{})
  Register(promisePreferCatch{})
  Register(promiseSpecOnly{})
  Register(promiseValidParams{})
}
