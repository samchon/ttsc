// unicorn/no-array-reduce: `Array#reduce` and `Array#reduceRight` collapse
// an iteration into a single callback that has to encode both the
// accumulator state and the per-element step, which routinely produces
// less-readable code than an explicit loop. The rule pushes authors
// toward `for…of` (or a typed accumulator initialized outside the loop)
// so the state and the step live on separate lines.
//
// AST-only: visit each `CallExpression`, check that the callee is a
// property access whose method identifier is `reduce` or `reduceRight`,
// and fire on the call. The receiver expression is not type-checked —
// the syntactic shape is the signal the rule wants to discourage.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-reduce.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoArrayReduce struct{}

func (unicornNoArrayReduce) Name() string { return "unicorn/no-array-reduce" }
func (unicornNoArrayReduce) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoArrayReduce) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  method := identifierText(access.Name())
  if method != "reduce" && method != "reduceRight" {
    return
  }
  ctx.Report(node, "Avoid `Array#"+method+"()` — use an explicit loop or `for…of` instead.")
}

func init() {
  Register(unicornNoArrayReduce{})
}
