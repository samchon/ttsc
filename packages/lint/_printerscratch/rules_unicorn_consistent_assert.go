// unicorn/consistent-assert: `assert.equal` and `assert.notEqual` perform
// loose equality (`==` / `!=`) at the runtime layer. The Node `assert`
// module ships strict counterparts — `assert.strictEqual` and
// `assert.notStrictEqual` — that read identically at the call site but
// hold the stronger invariant. The rule pins the strict variants so
// equality assertions don't silently accept type coercions.
//
// AST-only: visit each `CallExpression`. Match a callee of the shape
// `assert.equal` or `assert.notEqual` (a `PropertyAccessExpression`
// whose object identifier is `assert` and method name is one of the
// loose-equality pair). The diagnostic anchors on the call so editors
// can offer a strict-variant fix at the same position.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-assert.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornConsistentAssert struct{}

func (unicornConsistentAssert) Name() string { return "unicorn/consistent-assert" }
func (unicornConsistentAssert) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornConsistentAssert) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil || access.Expression == nil {
    return
  }
  if identifierText(access.Expression) != "assert" {
    return
  }
  switch identifierText(access.Name()) {
  case "equal", "notEqual":
  default:
    return
  }
  ctx.Report(node, "Use the strict variant — `assert.strictEqual` / `assert.notStrictEqual`.")
}

func init() {
  Register(unicornConsistentAssert{})
}
