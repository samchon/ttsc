// unicorn/prefer-spread suggests reviewing single-argument Array.from calls
// for a spread copy. Its AST baseline matches the name Array.from, not a
// resolved builtin or an iterable type. Array.from also accepts non-iterable
// array-like values, which spread rejects. Authors must establish iterable
// input and ordinary builtin behavior before making the change. No edit is
// supplied. Calls with a mapper or thisArg are not reported.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-spread.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferSpread struct{}

func (unicornPreferSpread) Name() string { return "unicorn/prefer-spread" }
func (unicornPreferSpread) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferSpread) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Name()) != "from" {
    return
  }
  receiver := stripParens(access.Expression)
  if identifierText(receiver) != "Array" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  ctx.Report(node, "Consider spread `[...x]` when the argument is iterable and no mapping is needed.")
}

func init() {
  Register(unicornPreferSpread{})
}
