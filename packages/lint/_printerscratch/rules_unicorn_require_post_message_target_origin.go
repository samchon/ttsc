// unicorn/require-post-message-target-origin: `Window#postMessage` and
// `Worker#postMessage` take a `targetOrigin` (or `transfer`) argument
// that scopes which document/worker may receive the message. Omitting
// it defaults to the receiver's own origin, which is a quiet security
// footgun — cross-origin frames silently lose the message. The rule
// asks every call site to pass an explicit second argument.
//
// AST-only: visit each `CallExpression`, accept only the property-access
// `x.postMessage` shape, and report when the call carries exactly one
// argument (the message payload, with no targetOrigin to follow).
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-post-message-target-origin.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornRequirePostMessageTargetOrigin struct{}

func (unicornRequirePostMessageTargetOrigin) Name() string {
  return "unicorn/require-post-message-target-origin"
}
func (unicornRequirePostMessageTargetOrigin) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornRequirePostMessageTargetOrigin) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Name()) != "postMessage" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  ctx.Report(node, "Pass an explicit `targetOrigin` argument to `postMessage`.")
}

func init() {
  Register(unicornRequirePostMessageTargetOrigin{})
}
