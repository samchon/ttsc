// maxParams: long parameter lists are almost always a code smell —
// readers cannot tell at the call site which argument means what, and
// the function usually wants to receive an options object instead.
// ESLint's default is `{ max: 3 }`, which @ttsc/lint mirrors as the
// only built-in threshold (option-decoding is deferred). Every
// function-like declaration counts: function declarations, function
// expressions, arrow functions, methods, accessors, and constructors.
// https://eslint.org/docs/latest/rules/max-params
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// maxParamsLimit is the parameter-count ceiling. Above this value the
// rule fires. Mirrors the ESLint default and matches the threshold
// documented in the README and website MDX.
const maxParamsLimit = 3

type maxParams struct{}

func (maxParams) Name() string { return "max-params" }
func (maxParams) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindConstructor,
  }
}
func (maxParams) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  params := node.Parameters()
  if len(params) <= maxParamsLimit {
    return
  }
  ctx.Report(node, fmt.Sprintf("Function has too many parameters (%d). Maximum allowed is %d.", len(params), maxParamsLimit))
}

func init() {
  Register(maxParams{})
}
