// unicorn/consistent-date-clone: the `Date` constructor copies a date
// directly when handed another `Date` instance, so the common
// `new Date(other.getTime())` shape adds a redundant `getTime()` hop
// that yields the same instant. The shorter `new Date(other)` form is
// the canonical clone.
//
// AST-only: visit each `NewExpression` whose callee identifier is
// `Date` and whose single argument is `<receiver>.getTime()` with no
// arguments. The receiver itself is opaque — only the call shape
// matters because any `Date`-valued expression yields the same clone
// when passed directly. The diagnostic anchors on the new-expression.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-date-clone.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornConsistentDateClone struct{}

func (unicornConsistentDateClone) Name() string {
  return "unicorn/consistent-date-clone"
}
func (unicornConsistentDateClone) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (unicornConsistentDateClone) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne == nil || identifierText(ne.Expression) != "Date" {
    return
  }
  if ne.Arguments == nil || len(ne.Arguments.Nodes) != 1 {
    return
  }
  arg := stripParens(ne.Arguments.Nodes[0])
  if arg == nil || arg.Kind != shimast.KindCallExpression {
    return
  }
  call := arg.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != "getTime" {
    return
  }
  if call.Arguments != nil && len(call.Arguments.Nodes) != 0 {
    return
  }
  ctx.Report(node, "Pass the `Date` directly to `new Date(...)` — `getTime()` is redundant.")
}

func init() {
  Register(unicornConsistentDateClone{})
}
