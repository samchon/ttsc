// unicorn/prefer-event-target: Node's `EventEmitter` is the legacy
// event API. The browser and modern Node (`>=15`) both ship the
// standard `EventTarget` interface, which works in both runtimes
// without a polyfill. Code that needs to run in both should prefer
// `EventTarget` so it stays portable.
//
// AST-only: visit `NewExpression`. Match when the callee is a bare
// identifier whose name is `EventEmitter`. The receiver is not
// type-checked — the rule's signal is the literal `new EventEmitter()`
// shape; a `new events.EventEmitter()` qualified form would not match,
// matching upstream's own AST-only behavior.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-event-target.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferEventTarget struct{}

func (unicornPreferEventTarget) Name() string { return "unicorn/prefer-event-target" }
func (unicornPreferEventTarget) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (unicornPreferEventTarget) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne == nil || ne.Expression == nil {
    return
  }
  if identifierText(ne.Expression) != "EventEmitter" {
    return
  }
  ctx.Report(node, "Prefer `EventTarget` over `EventEmitter` when sharing code between Node and the browser.")
}

func init() {
  Register(unicornPreferEventTarget{})
}
