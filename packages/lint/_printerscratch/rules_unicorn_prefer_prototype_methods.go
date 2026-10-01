// unicorn/prefer-prototype-methods: `[].slice`, `[].push`,
// `{}.hasOwnProperty` and similar empty-literal property accesses are
// shorthand for grabbing a prototype method without typing
// `Array.prototype.slice` / `Object.prototype.hasOwnProperty`. The
// shorthand allocates a throwaway literal at every call, hides the
// intent of borrowing a prototype method, and is slower than the
// direct prototype lookup.
//
// AST-only: visit each `PropertyAccessExpression`, then match the
// receiver against either an empty `ArrayLiteralExpression` (no
// elements) or an empty `ObjectLiteralExpression` (no properties).
// The property name is intentionally not restricted — any borrowed
// method should switch to the explicit `<Constructor>.prototype.<m>`
// form.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-prototype-methods.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferPrototypeMethods struct{}

func (unicornPreferPrototypeMethods) Name() string { return "unicorn/prefer-prototype-methods" }
func (unicornPreferPrototypeMethods) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (unicornPreferPrototypeMethods) Check(ctx *Context, node *shimast.Node) {
  access := node.AsPropertyAccessExpression()
  if access == nil || access.Expression == nil {
    return
  }
  receiver := stripParens(access.Expression)
  if receiver == nil {
    return
  }
  switch receiver.Kind {
  case shimast.KindArrayLiteralExpression:
    arr := receiver.AsArrayLiteralExpression()
    if arr == nil || arr.Elements == nil || len(arr.Elements.Nodes) != 0 {
      return
    }
  case shimast.KindObjectLiteralExpression:
    obj := receiver.AsObjectLiteralExpression()
    if obj == nil || obj.Properties == nil || len(obj.Properties.Nodes) != 0 {
      return
    }
  default:
    return
  }
  ctx.Report(node, "Use `Array.prototype.<method>` / `Object.prototype.<method>` instead of borrowing via an empty literal.")
}

func init() {
  Register(unicornPreferPrototypeMethods{})
}
