// unicorn/prefer-json-parse-buffer: as of Node 21, `JSON.parse`
// accepts a `Buffer` directly and decodes it internally, so the common
// `JSON.parse(buf.toString())` pattern allocates an extra intermediate
// string for nothing. Dropping the `.toString()` avoids the allocation
// and reads at least as clearly.
//
// AST-only: visit `CallExpression`. Match the outer call where the
// callee is `JSON.parse` (`PropertyAccess(Identifier("JSON"), parse)`)
// AND the single argument is itself a `CallExpression` whose callee is
// `PropertyAccess(_, toString)` taking no arguments — i.e. the
// syntactic shape `JSON.parse(x.toString())`. The receiver type of
// `x` is not checked, so non-buffer receivers will produce false
// positives; this is the documented trade for an AST-only port.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-json-parse-buffer.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferJsonParseBuffer struct{}

func (unicornPreferJsonParseBuffer) Name() string { return "unicorn/prefer-json-parse-buffer" }
func (unicornPreferJsonParseBuffer) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferJsonParseBuffer) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  // Callee must be `JSON.parse`.
  if call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Expression) != "JSON" || identifierText(access.Name()) != "parse" {
    return
  }
  // Argument must be `_.toString()` with no arguments.
  arg := stripParens(call.Arguments.Nodes[0])
  if arg == nil || arg.Kind != shimast.KindCallExpression {
    return
  }
  innerCall := arg.AsCallExpression()
  if innerCall == nil || innerCall.Expression == nil {
    return
  }
  if innerCall.Arguments != nil && len(innerCall.Arguments.Nodes) != 0 {
    return
  }
  if innerCall.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  innerAccess := innerCall.Expression.AsPropertyAccessExpression()
  if innerAccess == nil || identifierText(innerAccess.Name()) != "toString" {
    return
  }
  ctx.Report(node, "Prefer passing a `Buffer` directly to `JSON.parse` (Node 21+) over decoding to a string first.")
}

func init() {
  Register(unicornPreferJsonParseBuffer{})
}
