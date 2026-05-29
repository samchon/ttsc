// unicorn/prefer-response-static-json: `new Response(JSON.stringify(value), …)`
// is the manual two-step recipe — stringify then construct — that the
// platform's `Response.json(value, …)` static factory now performs in
// one call. The static factory also sets `Content-Type: application/json`
// automatically; the manual form leaves the header to the author.
//
// AST-only: visit each `NewExpression`. Match when the callee identifier
// is `Response` AND the first argument is a `CallExpression` whose
// callee is the property chain `JSON.stringify`. Other arguments (init
// options) are intentionally not inspected — the rule fires regardless
// of headers/status because the simpler factory handles both shapes.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-response-static-json.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferResponseStaticJson struct{}

func (unicornPreferResponseStaticJson) Name() string {
  return "unicorn/prefer-response-static-json"
}
func (unicornPreferResponseStaticJson) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (unicornPreferResponseStaticJson) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne == nil || identifierText(ne.Expression) != "Response" {
    return
  }
  if ne.Arguments == nil || len(ne.Arguments.Nodes) == 0 {
    return
  }
  first := stripParens(ne.Arguments.Nodes[0])
  if first == nil || first.Kind != shimast.KindCallExpression {
    return
  }
  call := first.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil ||
    identifierText(access.Expression) != "JSON" ||
    identifierText(access.Name()) != "stringify" {
    return
  }
  ctx.Report(node, "Prefer `Response.json(value)` over `new Response(JSON.stringify(value), ...)`.")
}

func init() {
  Register(unicornPreferResponseStaticJson{})
}
