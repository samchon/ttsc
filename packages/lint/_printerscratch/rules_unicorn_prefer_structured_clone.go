// unicorn/prefer-structured-clone: `JSON.parse(JSON.stringify(x))` is
// the historical deep-clone idiom. It silently drops everything JSON
// cannot round-trip — `Date`, `Map`, `Set`, typed arrays, cyclic
// references — and re-allocates a large intermediate string. The
// platform-native `structuredClone(x)` handles every transferable type,
// supports cycles, and avoids the string round-trip entirely.
//
// AST-only: visit each `CallExpression`, match `JSON.parse(arg)` whose
// single `arg` is itself a `JSON.stringify(...)` call. Both gates lock
// the receiver to the bare `JSON` identifier so member-access chains
// reading `parse`/`stringify` on a renamed alias do not trip the rule.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-structured-clone.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferStructuredClone struct{}

func (unicornPreferStructuredClone) Name() string {
  return "unicorn/prefer-structured-clone"
}
func (unicornPreferStructuredClone) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferStructuredClone) Check(ctx *Context, node *shimast.Node) {
  if !isJSONMethodCall(node, "parse") {
    return
  }
  outer := node.AsCallExpression()
  if outer == nil || outer.Arguments == nil || len(outer.Arguments.Nodes) != 1 {
    return
  }
  arg := stripParens(outer.Arguments.Nodes[0])
  if arg == nil || arg.Kind != shimast.KindCallExpression {
    return
  }
  if !isJSONMethodCall(arg, "stringify") {
    return
  }
  ctx.Report(node, "Prefer `structuredClone(x)` over `JSON.parse(JSON.stringify(x))`.")
}

// isJSONMethodCall reports whether `node` is a CallExpression whose
// callee is `JSON.<method>` — a property access reading `method` on a
// bare `JSON` identifier. The bare-identifier gate keeps the rule from
// firing on `aliased.parse(...)` shapes that happen to share the
// method name.
func isJSONMethodCall(node *shimast.Node, method string) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return false
  }
  if call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return false
  }
  if identifierText(access.Name()) != method {
    return false
  }
  return identifierText(stripParens(access.Expression)) == "JSON"
}

func init() {
  Register(unicornPreferStructuredClone{})
}
