// maxNestedCallbacks: deeply nested anonymous functions are the
// classic "callback hell" shape — every new layer pushes the actual
// work further to the right and makes control-flow harder to follow.
// ESLint's default ceiling is ten levels of nesting, which @ttsc/lint
// mirrors as the only built-in threshold (option-decoding is deferred).
// https://eslint.org/docs/latest/rules/max-nested-callbacks
//
// A "callback" here is a function-expression or arrow-function node
// that is an operand of a call expression, as an argument or as the
// callee of an immediately invoked function, looking through
// parentheses. A function assigned to a variable, returned, or stored
// in an object is not a callback and neither counts nor reports,
// matching ESLint, which pushes its stack only when the function's
// parent is a CallExpression. Depth counts the current callback plus
// every callback ancestor up to the enclosing source file;
// FunctionDeclaration, method and non-callback function boundaries are
// transparent.
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// maxNestedCallbacksLimit is the callback-nesting ceiling. Above this
// value the rule fires on the innermost callback. Mirrors the ESLint
// default of 10.
const maxNestedCallbacksLimit = 10

type maxNestedCallbacks struct{}

func (maxNestedCallbacks) Name() string { return "max-nested-callbacks" }
func (maxNestedCallbacks) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindArrowFunction,
    shimast.KindFunctionExpression,
  }
}
func (maxNestedCallbacks) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  if !isCallbackFunction(node) {
    return
  }
  // Count this callback plus every callback ancestor up to the
  // SourceFile. Functions that are not call operands, declarations,
  // methods, and accessors are transparent.
  depth := 1
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindArrowFunction, shimast.KindFunctionExpression:
      if isCallbackFunction(cur) {
        depth++
      }
    }
  }
  if depth <= maxNestedCallbacksLimit {
    return
  }
  ctx.Report(node, fmt.Sprintf("Too many nested callbacks (%d). Maximum allowed is %d.", depth, maxNestedCallbacksLimit))
}

// isCallbackFunction reports whether the function node is an argument or
// the callee of a call expression, looking through parentheses.
func isCallbackFunction(fn *shimast.Node) bool {
  parent := fn.Parent
  for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
    parent = parent.Parent
  }
  return parent != nil && parent.Kind == shimast.KindCallExpression
}

func init() {
  Register(maxNestedCallbacks{})
}
