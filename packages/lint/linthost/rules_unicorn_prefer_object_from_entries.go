// unicorn/prefer-object-from-entries reports two-argument .reduce calls with
// an empty object seed as candidates for manual review. The AST baseline
// does not inspect the reducer or prove that input elements are key/value
// pairs. Object.fromEntries is suitable only when that entry construction
// preserves the intended reducer behavior; numeric elements or arbitrary
// object accumulation do not satisfy that premise. No edit is supplied.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-object-from-entries.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferObjectFromEntries struct{}

func (unicornPreferObjectFromEntries) Name() string {
  return "unicorn/prefer-object-from-entries"
}
func (unicornPreferObjectFromEntries) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferObjectFromEntries) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != "reduce" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
    return
  }
  seed := stripParens(call.Arguments.Nodes[1])
  if seed == nil || seed.Kind != shimast.KindObjectLiteralExpression {
    return
  }
  obj := seed.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil || len(obj.Properties.Nodes) != 0 {
    return
  }
  ctx.Report(node, "Consider `Object.fromEntries(...)` if this reducer constructs an object from key/value pairs.")
}

func init() {
  Register(unicornPreferObjectFromEntries{})
}
