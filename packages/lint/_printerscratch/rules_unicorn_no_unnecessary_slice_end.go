// unicorn/no-unnecessary-slice-end reports a two-argument slice whose end
// repeats the receiver's length or uses Infinity. Under ordinary slice semantics
// those bounds select the tail. Another receiver's length is a real bound.
//
// Receiver comparison uses the shared structural reference helper, which excludes
// repeated calls. This AST baseline does not prove custom getter/method semantics
// or the binding of Infinity; the diagnostic supplies no automatic edit.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-slice-end.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnnecessarySliceEnd struct{}

func (unicornNoUnnecessarySliceEnd) Name() string {
  return "unicorn/no-unnecessary-slice-end"
}
func (unicornNoUnnecessarySliceEnd) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoUnnecessarySliceEnd) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Name()) != "slice" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
    return
  }
  second := stripParens(call.Arguments.Nodes[1])
  if !unicornUnnecessaryCountArgument(second, access.Expression) {
    return
  }
  ctx.Report(call.Arguments.Nodes[1], "Use `slice(start)` without the end — `.length` / `Infinity` is the default.")
}

func init() {
  Register(unicornNoUnnecessarySliceEnd{})
}
