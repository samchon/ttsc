// unicorn/prefer-array-find: `arr.filter(predicate)[0]` walks the full
// array and allocates an intermediate result just to discard everything
// after the first match. `arr.find(predicate)` returns the same value
// without the wasted work and reads as the actual intent.
//
// AST-only: visit each `ElementAccessExpression`. The receiver must be a
// `CallExpression` whose callee is a `PropertyAccess(_, filter)` and the
// index argument must be the numeric literal `0`. Reports on the element
// access so editors highlight the whole `.filter(...)[0]` chain.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-find.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferArrayFind struct{}

func (unicornPreferArrayFind) Name() string { return "unicorn/prefer-array-find" }
func (unicornPreferArrayFind) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindElementAccessExpression}
}
func (unicornPreferArrayFind) Check(ctx *Context, node *shimast.Node) {
  access := node.AsElementAccessExpression()
  if access == nil || access.Expression == nil || access.ArgumentExpression == nil {
    return
  }
  index := stripParens(access.ArgumentExpression)
  if index == nil || index.Kind != shimast.KindNumericLiteral {
    return
  }
  if numericLiteralText(index) != "0" {
    return
  }
  receiver := stripParens(access.Expression)
  if receiver == nil || receiver.Kind != shimast.KindCallExpression {
    return
  }
  call := receiver.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  prop := call.Expression.AsPropertyAccessExpression()
  if prop == nil || identifierText(prop.Name()) != "filter" {
    return
  }
  ctx.Report(node, "Prefer `Array#find()` over `Array#filter(...)[0]`.")
}

func init() {
  Register(unicornPreferArrayFind{})
}
