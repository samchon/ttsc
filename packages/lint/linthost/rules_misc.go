package linthost

import (
  "math"
  "strconv"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// radix: `parseInt(x)` without an explicit radix argument can trigger
// implementation-defined octal parsing in older environments. ESLint's
// default "always" mode requires the second argument and rejects a literal
// radix that is not an integer from 2 through 36.
// https://eslint.org/docs/latest/rules/radix
type radix struct{}

func (radix) Name() string           { return "radix" }
func (radix) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCallExpression} }
func (radix) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil {
    return
  }
  name := callCalleeName(call)
  if name != "parseInt" && name != "Number.parseInt" && !isMatchingPropertyAccess(call.Expression, "Number", "parseInt") {
    return
  }
  args := 0
  if call.Arguments != nil {
    args = len(call.Arguments.Nodes)
  }
  if args == 0 {
    return
  }
  if args == 1 {
    ctx.Report(node, "Missing radix parameter.")
    return
  }
  radixArg := call.Arguments.Nodes[1]
  radixArg = stripParens(radixArg)
  if radixArg == nil {
    ctx.Report(node, "Missing radix parameter.")
    return
  }
  // Only a radix whose value is known is judged: a number outside the integers
  // 2 through 36, a string, a boolean, `null` or `undefined` is invalid, while a
  // variable or call result cannot be checked statically.
  switch radixArg.Kind {
  case shimast.KindNumericLiteral:
    if !radixLiteralIsValid(numericLiteralText(radixArg)) {
      ctx.Report(radixArg, "Invalid radix parameter.")
    }
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTrueKeyword, shimast.KindFalseKeyword, shimast.KindNullKeyword,
    shimast.KindUndefinedKeyword:
    ctx.Report(radixArg, "Invalid radix parameter.")
  case shimast.KindIdentifier:
    if identifierText(radixArg) == "undefined" {
      ctx.Report(radixArg, "Invalid radix parameter.")
    }
  }
}

// radixLiteralIsValid reports whether a numeric literal is an integer from 2
// through 36, the range parseInt accepts as a radix.
func radixLiteralIsValid(text string) bool {
  clean := strings.ReplaceAll(text, "_", "")
  value, err := strconv.ParseFloat(clean, 64)
  if err != nil {
    parsed, intErr := strconv.ParseInt(clean, 0, 64)
    if intErr != nil {
      return false
    }
    value = float64(parsed)
  }
  return value == math.Trunc(value) && value >= 2 && value <= 36
}

// noNewWrappers: `new String("")`, `new Number(0)`, `new Boolean(false)`
// build wrapper objects rarely intended.
// https://eslint.org/docs/latest/rules/no-new-wrappers
type noNewWrappers struct{}

func (noNewWrappers) Name() string           { return "no-new-wrappers" }
func (noNewWrappers) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindNewExpression} }
func (noNewWrappers) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne == nil {
    return
  }
  switch identifierText(ne.Expression) {
  case "String", "Number", "Boolean":
    ctx.Report(node, "Do not use "+identifierText(ne.Expression)+" as a constructor.")
  }
}

func init() {
  Register(radix{})
  Register(noNewWrappers{})
}
