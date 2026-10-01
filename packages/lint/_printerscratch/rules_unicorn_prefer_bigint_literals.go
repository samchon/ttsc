// unicorn/prefer-bigint-literals prefers an integer bigint literal to an
// ordinary BigInt call with a known literal value. Numeric operands must be safe
// integers: fractional numbers throw, and unsafe numbers may already be rounded.
// Decimal integer strings retain their exact arbitrary-precision value.
//
// This AST baseline assumes the built-in BigInt binding. It supplies no edit;
// a suggested literal must spell the normalized value, rather than append n to
// an exponent, signed/zero-padded string or other original token spelling.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-bigint-literals.md
package linthost

import (
  "math"
  "strconv"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornPreferBigintLiterals struct{}

func (unicornPreferBigintLiterals) Name() string { return "unicorn/prefer-bigint-literals" }
func (unicornPreferBigintLiterals) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferBigintLiterals) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || identifierText(call.Expression) != "BigInt" {
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
    return
  }
  arg := stripParens(call.Arguments.Nodes[0])
  if arg == nil {
    return
  }
  switch arg.Kind {
  case shimast.KindNumericLiteral:
    // Numeric literal text is normalized by the pinned JavaScript scanner.
    // Only safe integers preserve their authored integer value under Number.
    value, err := strconv.ParseFloat(numericLiteralText(arg), 64)
    if err != nil || math.IsNaN(value) || math.IsInf(value, 0) || math.Trunc(value) != value || math.Abs(value) > 9007199254740991 {
      return
    }
  case shimast.KindStringLiteral:
    text := stringLiteralText(arg)
    if !unicornPreferBigintLiteralsIsDecimalInteger(text) {
      return
    }
  default:
    return
  }
  ctx.Report(node, "Prefer BigInt literal `1n` over `BigInt(1)`.")
}

// unicornPreferBigintLiteralsIsDecimalInteger accepts decimal digits with an
// optional leading sign. Hex, exponent and fractional strings remain calls.
func unicornPreferBigintLiteralsIsDecimalInteger(text string) bool {
  if text == "" {
    return false
  }
  i := 0
  if text[0] == '-' || text[0] == '+' {
    i++
  }
  if i == len(text) {
    return false
  }
  for ; i < len(text); i++ {
    ch := text[i]
    if ch < '0' || ch > '9' {
      return false
    }
  }
  return true
}

func init() {
  Register(unicornPreferBigintLiterals{})
}
