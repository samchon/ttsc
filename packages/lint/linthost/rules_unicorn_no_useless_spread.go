// unicorn/no-useless-spread: wrapping an already-spread literal in
// another spread produces the original literal — `[...[1, 2, 3]]` is
// just `[1, 2, 3]`, and `{...{a: 1}}` is `{a: 1}`. The extra spread
// reads like an attempted clone but allocates an intermediate literal
// for no observable effect.
//
// AST-only and conservative: visit every `ArrayLiteralExpression` and
// `ObjectLiteralExpression`; match when the literal contains exactly
// one element that is a `SpreadElement` / `SpreadAssignment` whose
// operand (after `stripParens`) is itself a literal of the same kind.
// The receiver expressions are not inspected — the syntactic shape
// `[...[…]]` / `{...{…}}` is the signal regardless of the inner
// literal's contents. Mirrors the conservative dispatch used by
// `unicorn/prefer-set-size`.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-spread.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessSpread struct{}

func (unicornNoUselessSpread) Name() string { return "unicorn/no-useless-spread" }
func (unicornNoUselessSpread) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindArrayLiteralExpression, shimast.KindObjectLiteralExpression}
}
func (unicornNoUselessSpread) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindArrayLiteralExpression:
    arr := node.AsArrayLiteralExpression()
    if arr == nil || arr.Elements == nil || len(arr.Elements.Nodes) != 1 {
      return
    }
    only := arr.Elements.Nodes[0]
    if only == nil || only.Kind != shimast.KindSpreadElement {
      return
    }
    spread := only.AsSpreadElement()
    if spread == nil {
      return
    }
    inner := stripParens(spread.Expression)
    if inner != nil && inner.Kind == shimast.KindArrayLiteralExpression {
      ctx.Report(node, "Don't wrap an already-spread literal in another spread.")
    }
  case shimast.KindObjectLiteralExpression:
    obj := node.AsObjectLiteralExpression()
    if obj == nil || obj.Properties == nil || len(obj.Properties.Nodes) != 1 {
      return
    }
    only := obj.Properties.Nodes[0]
    if only == nil || only.Kind != shimast.KindSpreadAssignment {
      return
    }
    spread := only.AsSpreadAssignment()
    if spread == nil {
      return
    }
    inner := stripParens(spread.Expression)
    if inner != nil && inner.Kind == shimast.KindObjectLiteralExpression {
      ctx.Report(node, "Don't wrap an already-spread literal in another spread.")
    }
  }
}

func init() {
  Register(unicornNoUselessSpread{})
}
