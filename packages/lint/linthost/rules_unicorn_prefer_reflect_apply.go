// unicorn/prefer-reflect-apply: `Function.prototype.apply.call(fn, thisArg, args)`
// is the long-hand pre-`Reflect.apply` workaround for invoking `apply`
// when the receiver may have shadowed it. `Reflect.apply(fn, thisArg, args)`
// expresses the same intent in a single named operation and survives
// `apply` being deleted from the prototype chain.
//
// AST-only and text-driven: visit each `CallExpression` and match the
// callee against the exact textual chain `Function.prototype.apply.call`.
// Comparing against the source text is the cleanest conservative
// recognition; alternate spellings (computed access, intermediate
// aliases) are intentionally out of scope.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-reflect-apply.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferReflectApply struct{}

func (unicornPreferReflectApply) Name() string { return "unicorn/prefer-reflect-apply" }
func (unicornPreferReflectApply) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferReflectApply) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if nodeText(ctx.File, call.Expression) != "Function.prototype.apply.call" {
    return
  }
  ctx.Report(node, "Prefer `Reflect.apply` over `Function.prototype.apply.call`.")
}

func init() {
  Register(unicornPreferReflectApply{})
}
