package linthost

import (
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
// The upstream rule checks three distinct `await`-flavored constructs, and
// this port mirrors all three:
//
//   - `await expr` — the operand must be a Promise or a thenable
//     (checkAwaitThenableExpression);
//   - `for await...of expr` — the source must expose the async-iterator
//     protocol (`[Symbol.asyncIterator]`), not merely the sync fallback
//     JavaScript permits (checkAwaitThenableForAwaitOf);
//   - `await using x = expr` — each initializer must expose the
//     async-dispose protocol (`[Symbol.asyncDispose]`), not only
//     `[Symbol.dispose]` (checkAwaitThenableAwaitUsing).
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
  case shimast.KindForOfStatement:
    checkAwaitThenableForAwaitOf(ctx, node)
  case shimast.KindVariableDeclarationList:
    checkAwaitThenableAwaitUsing(ctx, node)
  }
}

// checkAwaitThenableExpression handles the ordinary `await expr` arm: the
// operand must be awaitable (Promise, thenable, or a union/intersection with
// an awaitable constituent — see isAwaitable). The finding carries an autofix
// that drops the redundant `await ` keyword, which is behavior-preserving
// modulo one microtask hop.
func checkAwaitThenableExpression(ctx *Context, node *shimast.Node) {
  expr := node.AsAwaitExpression()
  if expr == nil || expr.Expression == nil {
    return
  }
  operandType := ctx.Checker.GetTypeAtLocation(expr.Expression)
  if operandType == nil {
    return
  }
  if isAwaitable(ctx.Checker, operandType) {
    return
  }
  message := "Unexpected `await` of a non-Promise (non-thenable) value."
  // Fix: drop the `await ` keyword and the following whitespace by
  // replacing [node.Pos(), expr.Expression.Pos()) with empty text.
  // `node.Pos()` may include leading trivia; use tokenRange to anchor
  // the start at the actual `await` token.
  startPos, _ := tokenRange(ctx.File, node)
  operandStart := expr.Expression.Pos()
  if startPos < 0 || operandStart <= startPos {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: startPos, End: operandStart, Text: ""},
  )
}

// checkAwaitThenableForAwaitOf handles the `for await...of` arm. Iterating a
// merely sync iterable with `for await` is legal JavaScript (the runtime
// falls back to the sync iterator and awaits each yielded value), but it has
// different iterator-closing/error semantics than a plain `for...of` and can
// obscure serial Promise consumption, so the upstream rule rejects any source
// whose type does not expose `[Symbol.asyncIterator]`. `any` escapes the
// check, mirroring typescript-eslint's `isTypeAnyType` gate. The diagnostic
// anchors on the iterable expression, not the whole statement, so the banner
// points at the offending value. No autofix: upstream ships only a manual
// suggestion here, because dropping the `await` changes runtime behavior
// (e.g. a sync iterable of Promises would stop resolving its elements).
func checkAwaitThenableForAwaitOf(ctx *Context, node *shimast.Node) {
  stmt := node.AsForInOrOfStatement()
  if stmt == nil || stmt.AwaitModifier == nil || stmt.Expression == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(stmt.Expression)
  if t == nil || t.Flags()&shimchecker.TypeFlagsAny != 0 {
    return
  }
  if hasWellKnownSymbolProperty(ctx.Checker, t, "asyncIterator") {
    return
  }
  ctx.Report(stmt.Expression, "Unexpected `for await...of` of a value that is not async iterable.")
}

// checkAwaitThenableAwaitUsing handles the `await using` arm. Awaiting the
// disposal of a resource that only implements `[Symbol.dispose]` is legal
// (the runtime wraps the sync disposer), but the `await` adds a scheduling
// point with no value, so the upstream rule requires every initializer to
// expose `[Symbol.asyncDispose]`. Declarations without an initializer (the
// `for (await using x of ...)` binding form) are skipped, as is `any`,
// mirroring typescript-eslint. Each offending declarator reports on its own
// initializer expression. No autofix: upstream offers only a manual
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
    if hasWellKnownSymbolProperty(ctx.Checker, t, "asyncDispose") {
      continue
    }
    ctx.Report(decl.Initializer, "Unexpected `await using` of a value that is not async disposable.")
  }
}

// hasWellKnownSymbolProperty reports whether `t` — or, for a union, ANY of
// its constituents — declares a property keyed by the global well-known
// symbol `Symbol.<symbolName>`. This mirrors ts-api-utils'
// `getWellKnownSymbolPropertyOfType` over `unionConstituents`, the exact
// predicate typescript-eslint's await-thenable uses for its `for await...of`
// and `await using` arms:
//
//   - the property NAME is resolved through the checker's own
//     `getPropertyNameForKnownSymbolName`, i.e. through the unique-symbol
//     type of the real global `SymbolConstructor` member, never by matching
//     source text or declared type names;
//   - the property LOOKUP goes through `GetPropertyOfType`, which resolves
//     apparent types (generic constraints, primitives), inherited members,
//     intersections, and type aliases.
//
// Union constituents are tested individually because a union type only
// surfaces properties present on every constituent, while upstream accepts a
// union when at least one constituent implements the protocol (e.g.
// `AsyncIterable<T> | Iterable<T>` stays valid under `for await`).
func hasWellKnownSymbolProperty(checker *shimchecker.Checker, t *shimchecker.Type, symbolName string) bool {
  if checker == nil || t == nil {
    return false
  }
  if t.Flags()&shimchecker.TypeFlagsUnion != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if hasWellKnownSymbolProperty(checker, part, symbolName) {
        return true
      }
    }
    return false
  }
  name := shimchecker.Checker_getPropertyNameForKnownSymbolName(checker, symbolName)
  if name == "" {
    return false
  }
  return checker.GetPropertyOfType(t, name) != nil
}

// isAwaitable reports whether `t` is safe to `await`. A type is awaitable
// when it is `any` / `unknown` / `never` (out of scope for strictness),
// when it is a Promise, when it is a thenable (has a callable `then`),
// or — for union/intersection types — when ANY constituent satisfies one
// of the above. The union case is the round-2 repair: `GetPromisedTypeOfPromise`
// returns nil on `Promise<X> | number` because the outer type is not a
// reference to globalPromise, and `GetPropertyOfType` filters `then` as
// a partial member, so without iterating constituents the rule would
// fire on legitimate code.
// isAwaitable reports whether t is safe to await. A type is awaitable when:
//   - its flags include Any, Unknown, or Never (these escape static strictness);
//   - it is a Promise (GetPromisedTypeOfPromise returns non-nil); or
//   - it is thenable (has a callable `then` property).
//
// For union and intersection types the function recurses into constituents: if
// ANY constituent is awaitable the whole type is considered awaitable. This is
// necessary because GetPromisedTypeOfPromise returns nil on composite types
// like `Promise<X> | number` even though the expression can legally be awaited.
func isAwaitable(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  if checker == nil || t == nil {
    return false
  }
  flags := t.Flags()
  if flags&shimchecker.TypeFlagsAny != 0 ||
    flags&shimchecker.TypeFlagsUnknown != 0 ||
    flags&shimchecker.TypeFlagsNever != 0 {
    return true
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if isAwaitable(checker, part) {
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

// noFloatingPromises: an `ExpressionStatement` whose value is a Promise but
// is neither awaited, wrapped in `void`, nor terminated by a rejection-aware
// handler (`.catch`, `.finally`, or `.then(_, onRejected)`) silently swallows
// any rejection produced by the Promise. The Node runtime emits
// `unhandledRejection` only for the outermost discarded Promise, so a single
// missing handler cascades into hard-to-trace failures. typescript-eslint
// recommended-type-checked:
// https://typescript-eslint.io/rules/no-floating-promises/
//
// Only `ExpressionStatement` is visited: assignments, return values, and
// argument positions are never "floating" because the surrounding context
// captures the Promise. The handler set mirrors `await-thenable`'s shape so
// the Checker calls stay confined to one file.
type noFloatingPromises struct{}

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
  expr := stripParens(stmt.Expression)
  if expr == nil {
    return
  }
  // Syntactic discharges short-circuit the Checker call: any of these
  // expression shapes already signals that the author opted out of the
  // "discarded" reading, so the rule never needs to walk the type system.
  if isPromiseHandledExpression(expr) {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(expr)
  if t == nil {
    return
  }
  if !isPromiseTypedExpression(ctx.Checker, t) {
    return
  }
  ctx.Report(node, "Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler, or be explicitly marked as ignored with the `void` operator.")
}

// isPromiseHandledExpression reports whether the expression is syntactically
// "handled" — already awaited, marked `void`, or terminated by a rejection-aware
// promise method. The list of accepted methods matches typescript-eslint's
// no-floating-promises: `catch` and `finally` always defuse the chain, while
// `then` only defuses it when an explicit rejection handler is supplied as the
// second argument.
func isPromiseHandledExpression(expr *shimast.Node) bool {
  if expr == nil {
    return false
  }
  switch expr.Kind {
  case shimast.KindAwaitExpression, shimast.KindVoidExpression:
    return true
  case shimast.KindCallExpression:
    call := expr.AsCallExpression()
    if call == nil {
      return false
    }
    method, ok := promiseMethodCallName(call)
    if !ok {
      return false
    }
    switch method {
    case "catch", "finally":
      return true
    case "then":
      return call.Arguments != nil && len(call.Arguments.Nodes) >= 2
    }
  }
  return false
}

// promiseMethodCallName returns the trailing property name when the call's
// callee is a property access (e.g. `getPromise().catch` -> "catch"). Unlike
// `promiseCallMethod`, it does NOT gate the result on whether the receiver
// looks like a Promise — the Checker handles that downstream when deciding
// whether the whole expression is still Promise-typed. The named-receiver
// constraint would otherwise reject legitimate handlers on user-typed
// objects such as `repo.users.findById(id).catch(reportError)`.
func promiseMethodCallName(call *shimast.CallExpression) (string, bool) {
  if call == nil || call.Expression == nil {
    return "", false
  }
  _, method, ok := promisePropertyAccessParts(call.Expression)
  if !ok {
    return "", false
  }
  return method, true
}

// isPromiseTypedExpression reports whether `t` represents a Promise (or thenable)
// at runtime. Mirrors `isAwaitable` but is intentionally stricter: `any` and
// `unknown` are NOT treated as floating, because that would explode on
// generic-helper boundaries; `never` is also skipped because a function whose
// return type is `never` cannot float a real Promise.
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
