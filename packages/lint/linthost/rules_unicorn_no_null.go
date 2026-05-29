// unicorn/no-null: the bare `null` literal is treated as a code smell —
// the rule's policy is that `undefined` is the single absent-value token
// in user code. Every occurrence of the keyword anywhere in the source is
// flagged so the codebase converges on one convention.
//
// AST-only: the engine dispatches once per `NullKeyword` node and the
// rule reports unconditionally on that node. There is no fixer in this
// pass — the diagnostic alone is the contract.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-null.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoNull struct{}

func (unicornNoNull) Name() string           { return "unicorn/no-null" }
func (unicornNoNull) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindNullKeyword} }
func (unicornNoNull) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Use `undefined` instead of `null`.")
}

func init() {
  Register(unicornNoNull{})
}
