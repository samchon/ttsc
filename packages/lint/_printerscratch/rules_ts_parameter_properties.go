// typescript/parameter-properties reports TypeScript parameter
// properties — constructor parameters prefixed with `public`,
// `private`, `protected`, `readonly`, or `override` that implicitly
// declare a class field. The rule's default policy
// (`prefer: "class-property"`) flags the shorthand so the class
// member list stays the single source of truth for the class shape;
// fields buried in the constructor signature are easy to miss.
// https://typescript-eslint.io/rules/parameter-properties/
//
// AST-only — the trigger is a syntactic modifier on a `KindParameter`
// whose parent is a `KindConstructor`. The shared `isParameterProperty`
// helper (also used by `no-unnecessary-parameter-property-assignment`)
// is the single decoding point for the modifier set.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type parameterProperties struct{}

func (parameterProperties) Name() string { return "typescript/parameter-properties" }
func (parameterProperties) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindParameter}
}
func (parameterProperties) Check(ctx *Context, node *shimast.Node) {
  if node == nil || node.Parent == nil || node.Parent.Kind != shimast.KindConstructor {
    return
  }
  if !isParameterProperty(node) {
    return
  }
  ctx.Report(node, "Prefer a plain class field declaration over a constructor parameter property.")
}

func init() {
  Register(parameterProperties{})
}
