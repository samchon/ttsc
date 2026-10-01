// unicorn/prefer-query-selector: `getElementById`,
// `getElementsByClassName`, and `getElementsByTagName` predate the CSS
// selector family on `Document` and `Element`. Unifying every lookup on
// `querySelector` / `querySelectorAll` lets callers compose selectors
// without juggling three different method signatures and live-collection
// semantics.
//
// AST-only: visit each `CallExpression`, match a property-access callee
// whose method identifier is one of the legacy lookup names, and fire
// when the call has exactly one string-literal argument. The
// string-literal gate isolates the canonical id/class/tag shape from
// runtime-built argument expressions that the rule would mis-suggest a
// selector for.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-query-selector.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornPreferQuerySelectorMethods = map[string]struct{}{
  "getElementById":         {},
  "getElementsByClassName": {},
  "getElementsByTagName":   {},
}

type unicornPreferQuerySelector struct{}

func (unicornPreferQuerySelector) Name() string { return "unicorn/prefer-query-selector" }
func (unicornPreferQuerySelector) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferQuerySelector) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  method := identifierText(access.Name())
  if _, ok := unicornPreferQuerySelectorMethods[method]; !ok {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  arg := call.Arguments.Nodes[0]
  if arg == nil || arg.Kind != shimast.KindStringLiteral {
    return
  }
  ctx.Report(node, "Prefer `querySelector` / `querySelectorAll` over `"+method+"`.")
}

func init() {
  Register(unicornPreferQuerySelector{})
}
