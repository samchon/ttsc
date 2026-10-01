// unicorn/require-array-join-separator: `Array#join()` defaults its
// separator to a comma when called with no arguments. Authors rarely
// mean to rely on that — the implicit separator is locale-flavored in
// related APIs (`Intl.ListFormat`) and the comma default is one of the
// quieter sources of "why is this comma here?" diffs. The rule pushes
// every call site to spell out the separator so the intent is in the
// source.
//
// AST-only: visit each `CallExpression`, accept only the property-access
// `x.join` shape, and report when the call carries zero arguments. Any
// explicit argument — empty string included — passes.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-array-join-separator.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornRequireArrayJoinSeparator struct{}

func (unicornRequireArrayJoinSeparator) Name() string {
  return "unicorn/require-array-join-separator"
}
func (unicornRequireArrayJoinSeparator) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornRequireArrayJoinSeparator) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Name()) != "join" {
    return
  }
  if call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
    return
  }
  ctx.Report(node, "Pass an explicit separator argument to `Array#join()`.")
}

func init() {
  Register(unicornRequireArrayJoinSeparator{})
}
