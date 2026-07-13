// unicorn/prefer-at: `arr[arr.length - 1]` is the legacy spelling of
// "last element". ES2022 introduced `Array#at(-N)` (and `String#at(-N)`)
// which lets you reach for the same value from the tail without
// repeating the receiver and the subtraction. The rule pushes authors
// toward the built-in.
//
// AST-only: visit each `ElementAccessExpression`. The index expression
// must be a `BinaryExpression` whose operator is `-`, whose left side is
// `PropertyAccess(_, length)`, and whose right side is a positive
// numeric literal. The `.length` receiver must be structurally equivalent to
// the indexed receiver; otherwise recommending `.at(-N)` would change which
// index is selected. The shared reference comparator ignores runtime-neutral
// TypeScript wrappers while rejecting effectful repeated expressions.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-at.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferAt struct{}

func (unicornPreferAt) Name() string { return "unicorn/prefer-at" }
func (unicornPreferAt) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindElementAccessExpression}
}
func (unicornPreferAt) Check(ctx *Context, node *shimast.Node) {
  access := node.AsElementAccessExpression()
  if access == nil || access.ArgumentExpression == nil {
    return
  }
  index := stripParens(access.ArgumentExpression)
  if index == nil || index.Kind != shimast.KindBinaryExpression {
    return
  }
  bin := index.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil ||
    bin.OperatorToken.Kind != shimast.KindMinusToken {
    return
  }
  left := stripParens(bin.Left)
  if left == nil || left.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  prop := left.AsPropertyAccessExpression()
  if prop == nil || identifierText(prop.Name()) != "length" {
    return
  }
  if !sameReferenceExpression(access.Expression, prop.Expression) {
    return
  }
  right := stripParens(bin.Right)
  if right == nil || right.Kind != shimast.KindNumericLiteral {
    return
  }
  text := numericLiteralText(right)
  if !unicornPreferAtIsPositiveInteger(text) {
    return
  }
  ctx.Report(node, "Prefer `Array#at(-N)` / `String#at(-N)` over `arr[arr.length - N]`.")
}

// unicornPreferAtIsPositiveInteger reports whether `text` is the literal
// form of a positive integer (>= 1). Leading zeros are accepted because
// the JS scanner already normalized them; the only rejections are the
// empty string, plain `0`, and anything containing a non-digit (decimals,
// `e`-notation, hex, bigint suffix).
func unicornPreferAtIsPositiveInteger(text string) bool {
  if text == "" || text == "0" {
    return false
  }
  for i := 0; i < len(text); i++ {
    c := text[i]
    if c < '0' || c > '9' {
      return false
    }
  }
  return true
}

func init() {
  Register(unicornPreferAt{})
}
