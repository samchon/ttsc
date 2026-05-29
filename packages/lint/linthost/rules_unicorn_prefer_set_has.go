// unicorn/prefer-set-has: `[a, b, c].includes(x)` is `O(n)` per lookup,
// while `new Set([a, b, c]).has(x)` is `O(1)` after a single `O(n)`
// construction. For repeated membership lookups against a fixed
// collection the `Set` form is meaningfully faster and clearer about
// intent.
//
// AST-only minimum-viable port: only the literal-array-receiver shape
// (`[…].includes(x)`) is reported. The upstream rule also reasons
// about typed variable receivers, which requires type-flow analysis
// out of scope for this slice; expanding to typed receivers is a
// follow-up.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-has.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferSetHas struct{}

func (unicornPreferSetHas) Name() string { return "unicorn/prefer-set-has" }
func (unicornPreferSetHas) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferSetHas) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != "includes" {
    return
  }
  receiver := stripParens(access.Expression)
  if receiver == nil || receiver.Kind != shimast.KindArrayLiteralExpression {
    return
  }
  ctx.Report(node, "Prefer `Set#has()` over `Array#includes()` for repeated membership lookups against a constant collection.")
}

func init() {
  Register(unicornPreferSetHas{})
}
