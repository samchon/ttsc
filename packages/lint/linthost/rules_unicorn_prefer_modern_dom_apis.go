// unicorn/prefer-modern-dom-apis: `Node#insertBefore`, `Node#replaceChild`,
// and `Element#insertAdjacentText` are the legacy mutation methods that
// still require the caller to thread a parent node and pass arguments in
// a specific order. The `before` / `after` / `replaceWith` family on
// `ChildNode` is the supported modern shape and accepts a variadic list
// of nodes and strings without needing the parent reference.
//
// AST-only: visit each `CallExpression`, match a property-access callee
// whose method identifier is one of the legacy mutation names, and fire
// on the call. Receivers and argument shapes are not validated — the
// method name alone is the signal the rule wants to discourage.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-modern-dom-apis.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornPreferModernDomApisMethods = map[string]struct{}{
  "insertBefore":       {},
  "replaceChild":       {},
  "insertAdjacentText": {},
}

type unicornPreferModernDomApis struct{}

func (unicornPreferModernDomApis) Name() string { return "unicorn/prefer-modern-dom-apis" }
func (unicornPreferModernDomApis) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferModernDomApis) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  method := identifierText(access.Name())
  if _, ok := unicornPreferModernDomApisMethods[method]; !ok {
    return
  }
  ctx.Report(node, "Prefer `before` / `after` / `replaceWith` over `"+method+"`.")
}

func init() {
  Register(unicornPreferModernDomApis{})
}
