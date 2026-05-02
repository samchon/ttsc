package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// radix: `parseInt(x)` without an explicit radix can hit the legacy
// "leading 0 means octal" trap. ESLint default mode requires the radix.
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
  if radixArg.Kind == shimast.KindNumericLiteral {
    text := numericLiteralText(radixArg)
    if text == "10" || text == "16" || text == "8" || text == "2" {
      return
    }
    ctx.Report(radixArg, "Invalid radix parameter.")
    return
  }
}

// no-new-wrappers: `new String("")`, `new Number(0)`, `new Boolean(false)`
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
