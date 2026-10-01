// unicorn/consistent-empty-array-spread: when an array literal contains
// a spread of a ternary, both branches should be arrays so the runtime
// shape of the parent literal stays uniform. The lopsided form
// `[1, ...(cond ? [x] : 2)]` mixes "spread an array" and "spread a
// non-array" — only one branch yields the structural shape the reader
// expects.
//
// AST-only: visit each `ArrayLiteralExpression`. For every element
// that is a `SpreadElement` wrapping a `ConditionalExpression`, fire
// when exactly one of the two branches is itself an array literal
// (the other branch is anything else). The diagnostic anchors on the
// spread so the editor highlights both the `...` and the ternary.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-empty-array-spread.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornConsistentEmptyArraySpread struct{}

func (unicornConsistentEmptyArraySpread) Name() string {
  return "unicorn/consistent-empty-array-spread"
}
func (unicornConsistentEmptyArraySpread) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindArrayLiteralExpression}
}
func (unicornConsistentEmptyArraySpread) Check(ctx *Context, node *shimast.Node) {
  arr := node.AsArrayLiteralExpression()
  if arr == nil || arr.Elements == nil {
    return
  }
  for _, el := range arr.Elements.Nodes {
    if el == nil || el.Kind != shimast.KindSpreadElement {
      continue
    }
    spread := el.AsSpreadElement()
    if spread == nil {
      continue
    }
    inner := stripParens(spread.Expression)
    if inner == nil || inner.Kind != shimast.KindConditionalExpression {
      continue
    }
    cond := inner.AsConditionalExpression()
    if cond == nil {
      continue
    }
    whenTrue := stripParens(cond.WhenTrue)
    whenFalse := stripParens(cond.WhenFalse)
    if whenTrue == nil || whenFalse == nil {
      continue
    }
    trueIsArr := whenTrue.Kind == shimast.KindArrayLiteralExpression
    falseIsArr := whenFalse.Kind == shimast.KindArrayLiteralExpression
    if trueIsArr != falseIsArr {
      ctx.Report(el, "When spreading a ternary in an array literal, both branches should be arrays.")
    }
  }
}

func init() {
  Register(unicornConsistentEmptyArraySpread{})
}
