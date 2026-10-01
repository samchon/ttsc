// unicorn/no-array-sort: `Array#sort()` mutates the array in place and
// returns the same reference, so any caller holding the original sees
// the sorted order too. ES2023 introduced `Array#toSorted()`, which
// returns a fresh sorted copy and leaves the source untouched; the rule
// pushes authors toward the non-mutating form.
//
// AST-only: visit each `CallExpression`, check that the callee is a
// property access whose method identifier is `sort`, and accept either
// zero arguments or exactly one (the optional comparator). Calls with
// two or more arguments are almost certainly a different `sort` on a
// user-defined type and are excluded by design.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-sort.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoArraySort struct{}

func (unicornNoArraySort) Name() string { return "unicorn/no-array-sort" }
func (unicornNoArraySort) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoArraySort) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Name()) != "sort" {
    return
  }
  if call.Arguments != nil && len(call.Arguments.Nodes) > 1 {
    return
  }
  ctx.Report(node, "Prefer `Array#toSorted()` over the mutating `Array#sort()`.")
}

func init() {
  Register(unicornNoArraySort{})
}
