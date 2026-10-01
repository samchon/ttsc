// maxNestedCallbacks: deeply nested anonymous functions are the
// classic "callback hell" shape — every new layer pushes the actual
// work further to the right and makes control-flow harder to follow.
// ESLint's default ceiling is ten levels of nesting, which @ttsc/lint
// mirrors as the only built-in threshold (option-decoding is deferred).
// https://eslint.org/docs/latest/rules/max-nested-callbacks
//
// A "callback" here is any function-expression or arrow-function node;
// named FunctionDeclarations are excluded from the count because the
// rule targets the anonymous-function nesting shape that produces
// callback hell, matching ESLint's behavior. Depth counts the current
// node plus every callback ancestor up to the enclosing source file;
// FunctionDeclaration boundaries are transparent because ESLint never
// pushes or pops the stack on them.
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
  // Count this callback plus every callback ancestor up to the
  // SourceFile. Only ArrowFunction and FunctionExpression
  // contribute; FunctionDeclaration, methods, and accessors are
  // transparent because ESLint never pushes or pops its callback
  // stack on those node kinds.
  depth := 1
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindArrowFunction, shimast.KindFunctionExpression:
      depth++
    }
  }
  if depth <= maxNestedCallbacksLimit {
    return
  }
  ctx.Report(node, fmt.Sprintf("Too many nested callbacks (%d). Maximum allowed is %d.", depth, maxNestedCallbacksLimit))
}

func init() {
  Register(maxNestedCallbacks{})
}
