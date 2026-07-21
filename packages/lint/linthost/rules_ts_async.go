// TypeScript async/error-flow rules: type-aware ports of the
// typescript-eslint recommended-type-checked rules that round out the
// async story alongside `typescript/await-thenable`,
// `typescript/no-floating-promises`, and `typescript/return-await`
// already in rules_promise.go.
//
// Implemented here:
//   - typescript/require-await
//     (type-aware; async function with no `await` that also returns no promise)
//   - typescript/use-unknown-in-catch-callback-variable
//     (type-aware; `.catch(err)` / `.then(_, err)` must annotate `unknown`)
//   - typescript/only-throw-error
//     (type-aware; `throw` of a primitive value)
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// requireAwait reports `async` function bodies that contain no `await`
// expression. The function still pays the microtask cost and signals
// async semantics to callers; the missing `await` is almost always a
// refactor artifact. typescript-eslint:
// https://typescript-eslint.io/rules/require-await/
//
// The walker stops at nested function-like boundaries so an
// `await` inside an inner non-async closure does not count toward the
// outer function. Async generators are exempt — they satisfy the
// async-keyword contract through `yield`.
type requireAwait struct{}

func (requireAwait) Name() string { return "typescript/require-await" }

// NeedsTypeChecker: upstream states the rule as "async functions which do not
// return promises and have no await expression", and that it "uses type
// information to allow promise-returning functions to be marked as async
// without containing an await expression". Whether a returned expression is
// thenable is not visible in the syntax.
func (requireAwait) NeedsTypeChecker() bool { return true }
func (requireAwait) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
  }
}
func (requireAwait) Check(ctx *Context, node *shimast.Node) {
  if !hasAsyncModifier(node) {
    return
  }
  if requireAwaitIsAsyncGenerator(node) {
    return
  }
  body := node.Body()
  if body == nil {
    return
  }
  if requireAwaitBodyHasAwait(body) {
    return
  }
  if requireAwaitReturnsThenable(ctx, body) {
    return
  }
  startPos := keywordStart(ctx.File, node, "async")
  if startPos < 0 {
    ctx.Report(node, "Async function has no `await` expression.")
    return
  }
  ctx.ReportRange(startPos, startPos+len("async"), "Async function has no `await` expression.")
}

// requireAwaitIsAsyncGenerator reports whether node is `async function*`,
// `async *method`, or the function-expression form thereof. Async
// generators are exempted by typescript-eslint: the generator's `yield`
// expressions express the suspend points and the rule would otherwise
// fire on every `async function*` that does not also `await`.
func requireAwaitIsAsyncGenerator(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    decl := node.AsFunctionDeclaration()
    return decl != nil && decl.AsteriskToken != nil
  case shimast.KindFunctionExpression:
    expr := node.AsFunctionExpression()
    return expr != nil && expr.AsteriskToken != nil
  case shimast.KindMethodDeclaration:
    decl := node.AsMethodDeclaration()
    return decl != nil && decl.AsteriskToken != nil
  }
  return false
}

// requireAwaitBodyHasAwait reports whether body (or any descendant that
// is not itself a nested function-like scope) contains an `await`
// expression. The walker mirrors `walkFunctionBody` in rules_promise.go
// but bails out early once an `await` is found.
func requireAwaitBodyHasAwait(body *shimast.Node) bool {
  found := false
  var walk func(*shimast.Node)
  walk = func(n *shimast.Node) {
    if found || n == nil {
      return
    }
    if n != body && isFunctionLikeKind(n) {
      return
    }
    if n.Kind == shimast.KindAwaitExpression {
      found = true
      return
    }
    // `for await (const x of source)` awaits every step of the iteration. It
    // is spelled as a for-of carrying an await modifier rather than as an
    // AwaitExpression, so a walker that looks only for the expression form
    // reports a function whose sole suspend point is the loop.
    if n.Kind == shimast.KindForOfStatement {
      if stmt := n.AsForInOrOfStatement(); stmt != nil && stmt.AwaitModifier != nil {
        found = true
        return
      }
    }
    n.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(body)
  return found
}

// useUnknownInCatchCallbackVariable requires the parameter of `.catch`
// and the second parameter of `.then` to be explicitly typed `unknown`.
// TypeScript 4.4+ types `try { } catch (e)` as `unknown` by default;
// promise chain callbacks still default to implicit `any`, so this rule
// closes that ergonomic gap. typescript-eslint:
// https://typescript-eslint.io/rules/use-unknown-in-catch-callback-variable/
//
// Type-aware: only fires when the receiver of `.catch` / `.then` is
// actually a Promise (rules out user-defined methods named `catch`).
// The annotation check is textual on the parameter's type node — the
// annotation must be exactly the token `unknown`.
type useUnknownInCatchCallbackVariable struct{}

func (useUnknownInCatchCallbackVariable) Name() string {
  return "typescript/use-unknown-in-catch-callback-variable"
}
func (useUnknownInCatchCallbackVariable) NeedsTypeChecker() bool {
  return true
}
func (useUnknownInCatchCallbackVariable) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (useUnknownInCatchCallbackVariable) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Arguments == nil {
    return
  }
  receiver, method, ok := promisePropertyAccessParts(call.Expression)
  if !ok || (method != "catch" && method != "then") {
    return
  }
  args := call.Arguments.Nodes
  var callback *shimast.Node
  switch method {
  case "catch":
    if len(args) < 1 {
      return
    }
    callback = stripParens(args[0])
  case "then":
    if len(args) < 2 {
      return
    }
    callback = stripParens(args[1])
  }
  if callback == nil || !isFunctionLikeKind(callback) {
    return
  }
  if receiver == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(receiver)
  if t == nil || !isPromiseTypedExpression(ctx.Checker, t) {
    return
  }
  params := callback.Parameters()
  if len(params) == 0 {
    return
  }
  param := params[0].AsParameterDeclaration()
  if param == nil {
    return
  }
  if param.Type == nil {
    ctx.Report(params[0], "Catch callback parameter should be explicitly typed `unknown`.")
    return
  }
  annotationText := nodeText(ctx.File, param.Type)
  if annotationText != "unknown" {
    ctx.Report(param.Type, "Catch callback parameter must be typed `unknown`, not `"+annotationText+"`.")
  }
}

// onlyThrowError reports `throw` of a value that is statically known
// to be a primitive (string / number / boolean / bigint / void /
// undefined / null). Throwing a non-Error loses the structured stack
// trace and breaks downstream `instanceof Error` checks.
// typescript-eslint:
// https://typescript-eslint.io/rules/only-throw-error/
//
// Type-aware. `any` / `unknown` / `never` pass through — they propagate
// from generic helpers and a strict rejection would explode at every
// re-throw of a caught `unknown`. Object types are conservatively
// allowed (a full base-type walk to confirm Error-derivation is
// deferred); the practical effect is that `throw "string"` and
// `throw 42` are caught but `throw { code: 1 }` slips through.
type onlyThrowError struct{}

func (onlyThrowError) Name() string { return "typescript/only-throw-error" }
func (onlyThrowError) NeedsTypeChecker() bool {
  return true
}
func (onlyThrowError) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindThrowStatement}
}
func (onlyThrowError) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  stmt := node.AsThrowStatement()
  if stmt == nil || stmt.Expression == nil {
    return
  }
  expr := stripParens(stmt.Expression)
  if expr == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(expr)
  if t == nil {
    return
  }
  if onlyThrowErrorIsPrimitive(ctx.Checker, t) {
    ctx.Report(node, "Throw an Error object instead of a non-Error value.")
  }
}

// onlyThrowErrorIsPrimitive returns true when t is a primitive type
// (string / number / boolean / bigint / void / undefined / null).
// any / unknown / never escape the check on purpose. Union and
// intersection types recurse — `string | number` is a primitive
// throw even though it is a composite type.
func onlyThrowErrorIsPrimitive(checker *shimchecker.Checker, t *shimchecker.Type) bool {
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
      if onlyThrowErrorIsPrimitive(checker, part) {
        return true
      }
    }
    return false
  }
  const primitiveMask = shimchecker.TypeFlagsStringLike |
    shimchecker.TypeFlagsNumberLike |
    shimchecker.TypeFlagsBigIntLike |
    shimchecker.TypeFlagsBooleanLike |
    shimchecker.TypeFlagsVoid |
    shimchecker.TypeFlagsUndefined |
    shimchecker.TypeFlagsNull
  return flags&primitiveMask != 0
}

func init() {
  Register(requireAwait{})
  Register(useUnknownInCatchCallbackVariable{})
  Register(onlyThrowError{})
}

// requireAwaitReturnsThenable reports whether the function body hands a
// thenable back to its caller.
//
// Upstream exempts these deliberately: `async function f() { return g() }`
// marks the async contract for callers and forwards the inner promise, which
// is a use of `async` rather than a leftover from a refactor. The walk stops at
// nested function-like scopes for the same reason the await walk does — an
// inner closure's `return` belongs to that closure.
//
// A concise arrow body (`async () => g()`) is the returned expression itself
// rather than a block, and is classified directly.
func requireAwaitReturnsThenable(ctx *Context, body *shimast.Node) bool {
  if ctx == nil || ctx.Checker == nil || body == nil {
    return false
  }
  if body.Kind != shimast.KindBlock {
    return requireAwaitExpressionIsThenable(ctx, body)
  }
  thenable := false
  var walk func(*shimast.Node)
  walk = func(n *shimast.Node) {
    if thenable || n == nil {
      return
    }
    if n != body && isFunctionLikeKind(n) {
      return
    }
    if n.Kind == shimast.KindReturnStatement {
      if stmt := n.AsReturnStatement(); stmt != nil && requireAwaitExpressionIsThenable(ctx, stmt.Expression) {
        thenable = true
        return
      }
    }
    n.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(body)
  return thenable
}

// requireAwaitExpressionIsThenable classifies one returned expression with the
// same awaitability test `await-thenable` uses, so the two rules agree on what
// counts as a promise. Anything the classifier does not rule out entirely is
// treated as thenable: the exemption must not depend on proving a union is
// thenable in every branch.
func requireAwaitExpressionIsThenable(ctx *Context, expr *shimast.Node) bool {
  if expr == nil {
    return false
  }
  t := ctx.Checker.GetTypeAtLocation(expr)
  if t == nil {
    return false
  }
  return classifyPromiseAwaitability(ctx.Checker, expr, t) != promiseAwaitabilityNever
}
