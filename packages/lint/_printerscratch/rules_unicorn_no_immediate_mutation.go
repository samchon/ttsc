// unicorn/no-immediate-mutation: mutating an expression on the same
// statement that produces it — e.g. `[1, 2, 3].push(4)` or
// `arr.map(...).sort()` — discards the mutator's return value (which is
// either the new length or `void`) and obscures whether the author
// wanted the array, the count, or the side effect. The rule splits the
// two operations: construct first, then mutate (or use the non-mutating
// counterpart).
//
// AST-only: visit each `CallExpression`. Match when the callee is a
// `PropertyAccessExpression(receiver, name)` where `name` is one of the
// mutating array methods AND the receiver (after `stripParens`) is
// either an `ArrayLiteralExpression` or another call expression whose
// callee is a non-mutating array method that produces a fresh array.
// Fire on the outer call.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-immediate-mutation.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornNoImmediateMutationMethods = map[string]struct{}{
  "push":       {},
  "pop":        {},
  "shift":      {},
  "unshift":    {},
  "splice":     {},
  "sort":       {},
  "reverse":    {},
  "copyWithin": {},
  "fill":       {},
}

var unicornNoImmediateMutationFreshMethods = map[string]struct{}{
  "map":     {},
  "filter":  {},
  "slice":   {},
  "concat":  {},
  "flat":    {},
  "flatMap": {},
}

type unicornNoImmediateMutation struct{}

func (unicornNoImmediateMutation) Name() string { return "unicorn/no-immediate-mutation" }
func (unicornNoImmediateMutation) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoImmediateMutation) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  method := identifierText(access.Name())
  if _, ok := unicornNoImmediateMutationMethods[method]; !ok {
    return
  }
  receiver := stripParens(access.Expression)
  if receiver == nil {
    return
  }
  if receiver.Kind == shimast.KindArrayLiteralExpression {
    ctx.Report(node, "Don't mutate a freshly built array — separate the construction and the mutation, or use a non-mutating method.")
    return
  }
  if receiver.Kind == shimast.KindCallExpression {
    inner := receiver.AsCallExpression()
    if inner == nil || inner.Expression == nil ||
      inner.Expression.Kind != shimast.KindPropertyAccessExpression {
      return
    }
    innerAccess := inner.Expression.AsPropertyAccessExpression()
    if innerAccess == nil {
      return
    }
    innerName := identifierText(innerAccess.Name())
    if _, ok := unicornNoImmediateMutationFreshMethods[innerName]; ok {
      ctx.Report(node, "Don't mutate a freshly built array — separate the construction and the mutation, or use a non-mutating method.")
    }
  }
}

func init() {
  Register(unicornNoImmediateMutation{})
}
