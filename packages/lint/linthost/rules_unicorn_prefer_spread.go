// unicorn/prefer-spread: `Array.from(x)` with a single iterable argument
// is equivalent to a spread copy `[...x]`. The spread form is shorter,
// reads as a value-level operation rather than a constructor call, and
// removes the `Array` global from the read path entirely.
//
// AST-only: visit each `CallExpression`, match `Array.from(x)` — a
// callee that is a property access reading `from` on a bare identifier
// `Array`, with exactly one argument. The single-argument restriction
// is load-bearing: `Array.from(x, mapFn)` and `Array.from(x, mapFn,
// thisArg)` have observable behavior the spread does not (the mapper
// receives the index, and `thisArg` is bound on a non-arrow mapper), so
// the rule deliberately stays away from them.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-spread.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferSpread struct{}

func (unicornPreferSpread) Name() string { return "unicorn/prefer-spread" }
func (unicornPreferSpread) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferSpread) Check(ctx *Context, node *shimast.Node) {
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
  if identifierText(access.Name()) != "from" {
    return
  }
  receiver := stripParens(access.Expression)
  if identifierText(receiver) != "Array" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  ctx.Report(node, "Prefer spread `[...x]` over `Array.from(x)` for single-arg shallow copies.")
}

func init() {
  Register(unicornPreferSpread{})
}
