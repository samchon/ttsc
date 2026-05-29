// unicorn/prefer-date-now: three idioms compute the current epoch
// milliseconds at runtime — `new Date().getTime()`, `new Date().valueOf()`,
// and `+new Date()`. All three allocate a Date instance only to throw
// it away. `Date.now()` does the same thing with no allocation and
// reads as exactly what it means; the rule asks authors to switch.
//
// AST-only: visit `KindCallExpression` (the `.getTime()` / `.valueOf()`
// callers) and `KindPrefixUnaryExpression` (the `+new Date()` form).
// Fire on:
//
//   - `(new Date()).getTime()` / `(new Date()).valueOf()` — a call
//     with no arguments whose callee is a PropertyAccessExpression
//     on a NewExpression with callee `Date`.
//   - `+new Date()` — a `+` prefix whose operand is a NewExpression
//     with callee `Date`.
//
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
    if ne == nil || identifierText(ne.Expression) != "Date" {
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
    if ne == nil || identifierText(ne.Expression) != "Date" {
      return
    }
    ctx.Report(node, "Prefer `Date.now()` over `new Date().getTime()` / `+new Date()`.")
  }
}

func init() {
  Register(unicornPreferDateNow{})
}
