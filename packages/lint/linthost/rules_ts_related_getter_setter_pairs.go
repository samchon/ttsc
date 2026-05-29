// typescript/related-getter-setter-pairs reports a `get` accessor
// whose declared return type does not match the parameter type of the
// companion `set` accessor on the same class. The accessor pair
// presents a single conceptual field at the call site — `obj.value =
// X` followed by `Y = obj.value` should round-trip with compatible
// types — but TypeScript otherwise lets the two accessors carry
// independent annotations. The rule fires when the writer cannot
// accept what the reader is about to surface.
// https://typescript-eslint.io/rules/related-getter-setter-pairs/
//
// Type-aware. The comparison resolves both sides through
// `GetTypeFromTypeNode` so type aliases, generic parameters, and union
// constituents collapse to the same set of values before the
// equality check. Without a Checker the rule short-circuits to a
// no-op the way the other type-aware rules do.
//
// The rule visits each `KindGetAccessor`. For every getter that
// carries a return-type annotation and lives inside a class
// declaration / expression, it locates the matching `set` accessor by
// name (using the same `classMembers` + `classMemberName` helpers as
// `class-literal-property-style`) and compares the annotated types
// bidirectionally — both sides must describe the same set of values
// for the accessor pair to round-trip safely.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type relatedGetterSetterPairs struct{}

func (relatedGetterSetterPairs) Name() string {
  return "typescript/related-getter-setter-pairs"
}
func (relatedGetterSetterPairs) NeedsTypeChecker() bool { return true }
func (relatedGetterSetterPairs) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindGetAccessor}
}
func (relatedGetterSetterPairs) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  parent := node.Parent
  if parent == nil ||
    (parent.Kind != shimast.KindClassDeclaration && parent.Kind != shimast.KindClassExpression) {
    return
  }
  getReturnType := node.Type()
  if getReturnType == nil {
    // No annotated return type — nothing to compare against.
    return
  }
  name := classMemberName(node)
  if name == "" {
    return
  }
  setter := findClassSetterFor(parent, name)
  if setter == nil {
    return
  }
  setParamType := setterParameterType(setter)
  if setParamType == nil {
    return
  }
  getType := ctx.Checker.GetTypeFromTypeNode(getReturnType)
  setType := ctx.Checker.GetTypeFromTypeNode(setParamType)
  if getType == nil || setType == nil {
    return
  }
  // Bidirectional assignability stands in for type identity — the
  // same shape `no-unnecessary-type-assertion` uses. The accessor
  // pair is safe only when reading and writing describe the same
  // set of values.
  if ctx.Checker.IsTypeAssignableTo(getType, setType) &&
    ctx.Checker.IsTypeAssignableTo(setType, getType) {
    return
  }
  ctx.Report(node, "Getter return type does not match the corresponding setter parameter type on `"+name+"`.")
}

// findClassSetterFor returns the `set` accessor declared on `class`
// whose name matches `name`, or nil when no such setter exists.
func findClassSetterFor(class *shimast.Node, name string) *shimast.Node {
  for _, member := range classMembers(class) {
    if member == nil || member.Kind != shimast.KindSetAccessor {
      continue
    }
    if classMemberName(member) == name {
      return member
    }
  }
  return nil
}

// setterParameterType returns the type-annotation node of a `set`
// accessor's single parameter. A setter without a parameter, or with a
// parameter that carries no annotation, returns nil — the rule cannot
// compare against an inferred type.
func setterParameterType(setter *shimast.Node) *shimast.Node {
  params := setter.Parameters()
  if len(params) == 0 {
    return nil
  }
  decl := params[0].AsParameterDeclaration()
  if decl == nil {
    return nil
  }
  return decl.Type
}

func init() {
  Register(relatedGetterSetterPairs{})
}
