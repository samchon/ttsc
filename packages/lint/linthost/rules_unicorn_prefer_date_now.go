// unicorn/prefer-date-now prefers Date.now() for a zero-argument Date
// construction used only to read its timestamp. Explicit constructor arguments
// select another instant and are retained, including spread arguments.
//
// This AST baseline assumes the ordinary built-in Date API. It matches
// getTime/valueOf calls without arguments and unary + on new Date().
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-date-now.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferDateNow struct{}

func (unicornPreferDateNow) Name() string { return "unicorn/prefer-date-now" }
func (unicornPreferDateNow) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression, shimast.KindPrefixUnaryExpression}
}
func (unicornPreferDateNow) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil || call.Expression == nil {
      return
    }
    if call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
      return
    }
    access := stripParens(call.Expression)
    if access == nil || access.Kind != shimast.KindPropertyAccessExpression {
      return
    }
    propAccess := access.AsPropertyAccessExpression()
    if propAccess == nil {
      return
    }
    method := identifierText(propAccess.Name())
    if method != "getTime" && method != "valueOf" {
      return
    }
    receiver := stripParens(propAccess.Expression)
    if receiver == nil || receiver.Kind != shimast.KindNewExpression {
      return
    }
    ne := receiver.AsNewExpression()
    if ne == nil || identifierText(ne.Expression) != "Date" || (ne.Arguments != nil && len(ne.Arguments.Nodes) != 0) {
      return
    }
    ctx.Report(node, "Prefer `Date.now()` over `new Date().getTime()` / `+new Date()`.")
  case shimast.KindPrefixUnaryExpression:
    prefix := node.AsPrefixUnaryExpression()
    if prefix == nil || prefix.Operator != shimast.KindPlusToken || prefix.Operand == nil {
      return
    }
    operand := stripParens(prefix.Operand)
    if operand == nil || operand.Kind != shimast.KindNewExpression {
      return
    }
    ne := operand.AsNewExpression()
    if ne == nil || identifierText(ne.Expression) != "Date" || (ne.Arguments != nil && len(ne.Arguments.Nodes) != 0) {
      return
    }
    ctx.Report(node, "Prefer `Date.now()` over `new Date().getTime()` / `+new Date()`.")
  }
}

func init() {
  Register(unicornPreferDateNow{})
}
