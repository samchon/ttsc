// unicorn/prefer-dom-node-append: `Node#appendChild` accepts a single
// child node, returns the appended node, and throws when handed a string
// — its `Node#append` successor accepts a variadic list of nodes and
// strings, returns `undefined`, and is the supported modern shape. The
// legacy form is what the rule discourages.
//
// AST-only: visit each `CallExpression`, match a property-access callee
// whose method identifier is `appendChild`, and fire on the call. The
// receiver expression is not type-checked — the syntactic shape is the
// signal the rule wants to discourage, regardless of whether the value is
// known to be a `Node` at the type level.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-append.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferDomNodeAppend struct{}

func (unicornPreferDomNodeAppend) Name() string { return "unicorn/prefer-dom-node-append" }
func (unicornPreferDomNodeAppend) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferDomNodeAppend) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Name()) != "appendChild" {
    return
  }
  ctx.Report(node, "Prefer `Node#append()` over `Node#appendChild()`.")
}

func init() {
  Register(unicornPreferDomNodeAppend{})
}
