// unicorn/prefer-dom-node-text-content: `HTMLElement#innerText` triggers
// layout, ignores hidden subtrees, and varies across engines — its
// `Node#textContent` counterpart returns the raw concatenated text of
// every descendant text node and is the supported modern shape.
//
// AST-only and identifier-text-driven: visit every
// `PropertyAccessExpression`, match the property name `innerText`, and
// fire on the property-access node. The receiver expression is not
// type-checked; the legacy property name is the signal the rule
// discourages.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-text-content.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferDomNodeTextContent struct{}

func (unicornPreferDomNodeTextContent) Name() string {
  return "unicorn/prefer-dom-node-text-content"
}
func (unicornPreferDomNodeTextContent) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (unicornPreferDomNodeTextContent) Check(ctx *Context, node *shimast.Node) {
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Name()) != "innerText" {
    return
  }
  ctx.Report(node, "Prefer `Node#textContent` over `HTMLElement#innerText`.")
}

func init() {
  Register(unicornPreferDomNodeTextContent{})
}
