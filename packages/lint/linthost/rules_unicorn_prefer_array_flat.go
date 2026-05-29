// unicorn/prefer-array-flat: `[].concat(a, b, c)` is the legacy flatten
// idiom — it works because `Array#concat` spreads array arguments — but
// it loses readability the moment a non-array sneaks into the argument
// list (it then gets pushed in as a single element instead of being
// flattened). `Array#flat()` has stable, type-aware semantics and is the
// supported one-line equivalent.
//
// AST-only: visit each `CallExpression`, match a property-access callee
// whose receiver is an empty array-literal expression and whose method
// identifier is `concat`, and fire when at least one argument is
// supplied. The empty-array receiver gate is what isolates the
// flattening idiom from ordinary `.concat()` usage on real arrays.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-flat.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferArrayFlat struct{}

func (unicornPreferArrayFlat) Name() string { return "unicorn/prefer-array-flat" }
func (unicornPreferArrayFlat) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferArrayFlat) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Name()) != "concat" {
    return
  }
  receiver := stripParens(access.Expression)
  if receiver == nil || receiver.Kind != shimast.KindArrayLiteralExpression {
    return
  }
  arr := receiver.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil || len(arr.Elements.Nodes) != 0 {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  ctx.Report(node, "Prefer `Array#flat()` over `[].concat(...arrays)`.")
}

func init() {
  Register(unicornPreferArrayFlat{})
}
