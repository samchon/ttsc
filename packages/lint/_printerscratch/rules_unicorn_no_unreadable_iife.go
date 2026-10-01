// unicorn/no-unreadable-iife: an IIFE whose body is itself another
// call expression — `(() => f())()` — reads as two layers of
// invocation for one effective call. The shape obscures the actual
// computation and the rule asks authors to extract the call site so
// the inner function name appears at the top level instead of being
// hidden behind an anonymous arrow.
//
// AST-only: visit `KindCallExpression`, accept when the callee is a
// `KindParenthesizedExpression` wrapping a `KindArrowFunction` whose
// body is a `KindCallExpression`. Block-bodied arrows and arrows that
// return a non-call expression don't match — only the arrow → call
// shape is "unreadable" in the upstream sense.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unreadable-iife.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnreadableIIFE struct{}

func (unicornNoUnreadableIIFE) Name() string { return "unicorn/no-unreadable-iife" }
func (unicornNoUnreadableIIFE) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoUnreadableIIFE) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if call.Expression.Kind != shimast.KindParenthesizedExpression {
    return
  }
  paren := call.Expression.AsParenthesizedExpression()
  if paren == nil || paren.Expression == nil ||
    paren.Expression.Kind != shimast.KindArrowFunction {
    return
  }
  arrow := paren.Expression.AsArrowFunction()
  if arrow == nil || arrow.Body == nil {
    return
  }
  if arrow.Body.Kind != shimast.KindCallExpression {
    return
  }
  ctx.Report(node, "Avoid unreadable IIFEs — extract the function.")
}

func init() {
  Register(unicornNoUnreadableIIFE{})
}
