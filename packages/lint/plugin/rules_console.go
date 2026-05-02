package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-console: forbid `console.*` calls. This implementation models the
// default rule shape and flags every console method.
// https://eslint.org/docs/latest/rules/no-console
type noConsole struct{}

func (noConsole) Name() string           { return "no-console" }
func (noConsole) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCallExpression} }
func (noConsole) Check(ctx *Context, node *shimast.Node) {
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
  if identifierText(access.Expression) != "console" {
    return
  }
  method := identifierText(access.Name())
  if method == "" {
    return
  }
  ctx.Report(node, "Unexpected console statement.")
}

func init() {
  Register(noConsole{})
}
