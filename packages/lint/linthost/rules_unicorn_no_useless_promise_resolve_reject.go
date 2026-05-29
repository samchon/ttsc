// unicorn/no-useless-promise-resolve-reject: inside an `async`
// function, `return x` already wraps the value in a resolved promise
// and `throw err` already produces a rejected one. Writing `return
// Promise.resolve(x)` or `return Promise.reject(err)` rebuilds the
// wrapper the runtime would build anyway, hides the actual value
// behind an extra call, and reads as if the author forgot the
// function was async.
//
// AST-only and parent-walking: visit each `ReturnStatement`, find the
// nearest enclosing function-like ancestor, and require it to carry
// the `async` modifier. The return's expression after `stripParens`
// must be a `CallExpression` whose callee is
// `PropertyAccess(Identifier("Promise"), name)` with
// `name ∈ {resolve, reject}`. Arrow concise bodies are not handled
// here because the rule's contract anchors on the `return` keyword.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-promise-resolve-reject.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessPromiseResolveReject struct{}

func (unicornNoUselessPromiseResolveReject) Name() string {
  return "unicorn/no-useless-promise-resolve-reject"
}
func (unicornNoUselessPromiseResolveReject) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindReturnStatement}
}
func (unicornNoUselessPromiseResolveReject) Check(ctx *Context, node *shimast.Node) {
  ret := node.AsReturnStatement()
  if ret == nil || ret.Expression == nil {
    return
  }
  if !unicornNoUselessPromiseResolveRejectInAsync(node) {
    return
  }
  expr := stripParens(ret.Expression)
  if expr == nil || expr.Kind != shimast.KindCallExpression {
    return
  }
  call := expr.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Expression) != "Promise" {
    return
  }
  switch identifierText(access.Name()) {
  case "resolve", "reject":
  default:
    return
  }
  ctx.Report(node, "In `async` functions, `return x` and `throw e` work identically — drop the `Promise.<method>` wrapper.")
}

// unicornNoUselessPromiseResolveRejectInAsync walks ancestors of `node`
// and reports whether the nearest enclosing function-like declaration
// is marked `async`. Crossing a function boundary that is not async
// stops the walk — a nested non-async function shadows the outer
// async context.
func unicornNoUselessPromiseResolveRejectInAsync(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindFunctionDeclaration,
      shimast.KindFunctionExpression,
      shimast.KindArrowFunction,
      shimast.KindMethodDeclaration:
      return hasModifier(cur, shimast.KindAsyncKeyword)
    }
  }
  return false
}

func init() {
  Register(unicornNoUselessPromiseResolveReject{})
}
