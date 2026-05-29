// unicorn/no-magic-array-flat-depth: `Array#flat(depth)` accepts a numeric
// argument that controls how many nested levels are flattened. Magic
// numbers like `.flat(2)` or `.flat(3)` make the call hard to scan —
// readers must mentally model the input shape to decide whether the
// depth is correct. The rule allows `1` (the default depth, common
// enough to read at a glance) and `Infinity` (an explicit named value)
// but flags every other numeric literal so authors switch to either
// `Infinity` or a named constant.
//
// AST-only: dispatch on `KindCallExpression`, require a property-access
// callee whose method identifier is `flat`, exactly one argument, and
// that argument to be `KindNumericLiteral` with text other than "1".
// `Infinity` is parsed as an Identifier, not a NumericLiteral, so the
// kind check alone exempts it without a separate value branch.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-magic-array-flat-depth.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoMagicArrayFlatDepth struct{}

func (unicornNoMagicArrayFlatDepth) Name() string { return "unicorn/no-magic-array-flat-depth" }
func (unicornNoMagicArrayFlatDepth) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoMagicArrayFlatDepth) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != "flat" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  arg := stripParens(call.Arguments.Nodes[0])
  if arg == nil || arg.Kind != shimast.KindNumericLiteral {
    return
  }
  if numericLiteralText(arg) == "1" {
    return
  }
  ctx.Report(node, "Don't use a magic-number depth in `Array#flat()` — use `Infinity` or a named constant.")
}

func init() {
  Register(unicornNoMagicArrayFlatDepth{})
}
