package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noExtendNative: forbid assignments to `<Builtin>.prototype.<key>`,
// which mutate a shared global and leak across the entire realm.
// https://eslint.org/docs/latest/rules/no-extend-native
type noExtendNative struct{}

func (noExtendNative) Name() string           { return "no-extend-native" }
func (noExtendNative) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noExtendNative) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return
  }
  if expr.OperatorToken.Kind != shimast.KindEqualsToken {
    return
  }
  outer := stripParens(expr.Left)
  if outer == nil || outer.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  receiver := stripParens(outer.AsPropertyAccessExpression().Expression)
  if receiver == nil || receiver.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  inner := receiver.AsPropertyAccessExpression()
  if identifierText(inner.Name()) != "prototype" {
    return
  }
  builtin := identifierText(stripParens(inner.Expression))
  if !isExtendNativeBuiltin(builtin) {
    return
  }
  ctx.Report(node, builtin+" prototype is read only, properties should not be added.")
}

func isExtendNativeBuiltin(name string) bool {
  switch name {
  case "Object", "Array", "String", "Number", "Boolean", "Function",
    "Date", "RegExp", "Error", "Map", "Set", "WeakMap", "WeakSet",
    "Promise", "Symbol":
    return true
  }
  return false
}

func init() {
  Register(noExtendNative{})
}
