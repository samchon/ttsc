// unicorn/no-await-in-promise-methods: awaiting an element inside the
// array argument of `Promise.all` / `Promise.allSettled` / `Promise.race`
// / `Promise.any` defeats the parallelism the call exists for. The
// awaits resolve serially in source order before the array is even
// handed to `Promise.<method>`, so the combinator only sees the
// already-resolved values.
//
// AST-only: visit each `CallExpression`, match the callee against
// `Promise.<method>` for the four parallel combinators, and check the
// sole argument's `ArrayLiteralExpression` elements for any
// `AwaitExpression` shape. Fire on the offending await node so the
// report anchors to the actual misuse.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-await-in-promise-methods.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornNoAwaitInPromiseMethodsMethods = map[string]struct{}{
  "all":        {},
  "allSettled": {},
  "race":       {},
  "any":        {},
}

type unicornNoAwaitInPromiseMethods struct{}

func (unicornNoAwaitInPromiseMethods) Name() string {
  return "unicorn/no-await-in-promise-methods"
}
func (unicornNoAwaitInPromiseMethods) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoAwaitInPromiseMethods) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Expression) != "Promise" {
    return
  }
  method := identifierText(access.Name())
  if _, ok := unicornNoAwaitInPromiseMethodsMethods[method]; !ok {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  arg := call.Arguments.Nodes[0]
  if arg == nil || arg.Kind != shimast.KindArrayLiteralExpression {
    return
  }
  arr := arg.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil {
    return
  }
  for _, elem := range arr.Elements.Nodes {
    if elem != nil && elem.Kind == shimast.KindAwaitExpression {
      ctx.Report(elem, "Don't `await` inside `Promise."+method+"` array members — the awaits serialize the calls.")
    }
  }
}

func init() {
  Register(unicornNoAwaitInPromiseMethods{})
}
