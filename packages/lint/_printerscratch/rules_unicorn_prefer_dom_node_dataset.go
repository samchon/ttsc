// unicorn/prefer-dom-node-dataset: `Element#dataset` exposes every
// `data-*` attribute as a typed string property, including coordinated
// kebab-case → camelCase mapping and conversion to/from values. Reaching
// for `getAttribute("data-foo")` or `setAttribute("data-foo", …)`
// reintroduces string-key bookkeeping the platform already covers.
//
// AST-only: visit each `CallExpression`, match a property-access callee
// whose method identifier is `getAttribute` or `setAttribute`, and fire
// when the first argument is a `StringLiteral` whose text starts with
// `data-`. The literal-prefix gate isolates the data-attribute path from
// every other attribute the same methods reach.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-dom-node-dataset.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornPreferDomNodeDataset struct{}

func (unicornPreferDomNodeDataset) Name() string { return "unicorn/prefer-dom-node-dataset" }
func (unicornPreferDomNodeDataset) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferDomNodeDataset) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  method := identifierText(access.Name())
  if method != "getAttribute" && method != "setAttribute" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  first := call.Arguments.Nodes[0]
  if first == nil || first.Kind != shimast.KindStringLiteral {
    return
  }
  if !strings.HasPrefix(stringLiteralText(first), "data-") {
    return
  }
  ctx.Report(node, "Prefer `.dataset` over `getAttribute` / `setAttribute` for `data-*` attributes.")
}

func init() {
  Register(unicornPreferDomNodeDataset{})
}
