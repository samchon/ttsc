// unicorn/prefer-native-coercion-functions: an arrow that does nothing
// but pass its parameter to `String` / `Number` / `Boolean` / `BigInt`
// / `Symbol` is a wrapper around a function that already has the same
// signature. Passing the built-in reference directly drops a closure
// allocation, a stack frame, and a layer of indirection at every call
// site while reading as the operation it actually performs.
//
// AST-only: visit `KindArrowFunction` and `KindFunctionExpression`. Fire
// when the function takes exactly one bare-identifier parameter AND its
// body is either an arrow expression body that calls one of the named
// constructors with the parameter as the sole argument, or a block body
// with a single `return <Name>(<param>);` statement.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-native-coercion-functions.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferNativeCoercionFunctions struct{}

func (unicornPreferNativeCoercionFunctions) Name() string {
  return "unicorn/prefer-native-coercion-functions"
}
func (unicornPreferNativeCoercionFunctions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindArrowFunction, shimast.KindFunctionExpression}
}
func (unicornPreferNativeCoercionFunctions) Check(ctx *Context, node *shimast.Node) {
  params := node.Parameters()
  if len(params) != 1 {
    return
  }
  paramName := parameterIdentifierName(params[0])
  if paramName == "" {
    return
  }
  var body *shimast.Node
  switch node.Kind {
  case shimast.KindArrowFunction:
    if arrow := node.AsArrowFunction(); arrow != nil {
      body = arrow.Body
    }
  case shimast.KindFunctionExpression:
    if fn := node.AsFunctionExpression(); fn != nil {
      body = fn.Body
    }
  }
  if body == nil {
    return
  }
  call := unicornPreferNativeCoercionBodyCall(body)
  if call == nil {
    return
  }
  if !unicornPreferNativeCoercionIsCoercion(call, paramName) {
    return
  }
  ctx.Report(node, "Use the bare `String` / `Number` / `Boolean` / `BigInt` function reference instead of an arrow wrapper.")
}

// unicornPreferNativeCoercionBodyCall normalizes a function body to the
// inner `CallExpression`. A concise arrow body returns its expression
// directly; a block body must contain exactly one `return <expr>;` and
// the returned expression must itself be a call.
func unicornPreferNativeCoercionBodyCall(body *shimast.Node) *shimast.Node {
  if body == nil {
    return nil
  }
  if body.Kind != shimast.KindBlock {
    expr := stripParens(body)
    if expr == nil || expr.Kind != shimast.KindCallExpression {
      return nil
    }
    return expr
  }
  block := body.AsBlock()
  if block == nil || block.Statements == nil || len(block.Statements.Nodes) != 1 {
    return nil
  }
  stmt := block.Statements.Nodes[0]
  if stmt == nil || stmt.Kind != shimast.KindReturnStatement {
    return nil
  }
  ret := stmt.AsReturnStatement()
  if ret == nil || ret.Expression == nil {
    return nil
  }
  expr := stripParens(ret.Expression)
  if expr == nil || expr.Kind != shimast.KindCallExpression {
    return nil
  }
  return expr
}

// unicornPreferNativeCoercionIsCoercion reports whether `call` is a
// `String|Number|Boolean|BigInt|Symbol(<param>)` invocation where the
// single argument is the parameter identifier.
func unicornPreferNativeCoercionIsCoercion(call *shimast.Node, paramName string) bool {
  c := call.AsCallExpression()
  if c == nil || c.Expression == nil {
    return false
  }
  switch identifierText(c.Expression) {
  case "String", "Number", "Boolean", "BigInt", "Symbol":
  default:
    return false
  }
  if c.Arguments == nil || len(c.Arguments.Nodes) != 1 {
    return false
  }
  return identifierText(stripParens(c.Arguments.Nodes[0])) == paramName
}

func init() {
  Register(unicornPreferNativeCoercionFunctions{})
}
