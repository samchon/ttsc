// unicorn/no-unnecessary-array-flat-depth: `Array#flat()` already defaults
// to depth `1`, so writing `.flat(1)` is a redundant spelling that adds
// noise without changing behavior. The rule flags the explicit `1` so
// the call collapses to the dependency-free `.flat()` shorthand.
//
// AST-only: dispatch on `KindCallExpression`, require a property-access
// callee whose method identifier is `flat`, exactly one argument, and
// that argument's NumericLiteral text to be "1". Other numeric arguments
// are handled by `unicorn/no-magic-array-flat-depth`; this sibling rule
// only owns the literal-`1` shape.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-array-flat-depth.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnnecessaryArrayFlatDepth struct{}

func (unicornNoUnnecessaryArrayFlatDepth) Name() string {
  return "unicorn/no-unnecessary-array-flat-depth"
}
func (unicornNoUnnecessaryArrayFlatDepth) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoUnnecessaryArrayFlatDepth) Check(ctx *Context, node *shimast.Node) {
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
  if numericLiteralText(arg) != "1" {
    return
  }
  ctx.Report(node, "`Array#flat()` already defaults to depth 1 — omit the argument.")
}

func init() {
  Register(unicornNoUnnecessaryArrayFlatDepth{})
}
