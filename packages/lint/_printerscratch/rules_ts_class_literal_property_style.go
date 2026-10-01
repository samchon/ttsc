// AST-only `typescript/class-literal-property-style` rule from
// typescript-eslint. Implemented here as a standalone file because the
// rule's literal-shape predicate and getter/setter pairing are
// self-contained and unrelated to the other class-shape rules already
// living in rules_ts_simple.go.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// classLiteralPropertyStyle reports `get foo() { return <literal>; }`
// accessors that have no companion setter — those should be expressed
// as a `readonly foo = <literal>;` field declaration. The getter form
// re-runs the body on every read and obscures the fact that the value
// is fixed; a readonly field is shorter, type-narrows to the literal
// type, and signals "this is a constant" at the call site.
// https://typescript-eslint.io/rules/class-literal-property-style/
//
// Default upstream config is `"fields"`, matching the wording above.
// The rule fires when:
//   - the class member is a `get` accessor,
//   - its body is a block containing a single `return <literal>;`,
//   - the literal is a string, number, boolean, `null`, a template
//     literal with no substitutions, or a unary-minus prefix on a
//     numeric literal,
//   - the class has no `set` accessor for the same member name.
type classLiteralPropertyStyle struct{}

func (classLiteralPropertyStyle) Name() string {
  return "typescript/class-literal-property-style"
}
func (classLiteralPropertyStyle) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindGetAccessor}
}
func (classLiteralPropertyStyle) Check(ctx *Context, node *shimast.Node) {
  parent := node.Parent
  if parent == nil ||
    (parent.Kind != shimast.KindClassDeclaration && parent.Kind != shimast.KindClassExpression) {
    return
  }
  accessor := node.AsGetAccessorDeclaration()
  if accessor == nil || accessor.Body == nil || accessor.Body.Kind != shimast.KindBlock {
    return
  }
  statements := accessor.Body.Statements()
  if len(statements) != 1 {
    return
  }
  ret := statements[0]
  if ret == nil || ret.Kind != shimast.KindReturnStatement {
    return
  }
  retStmt := ret.AsReturnStatement()
  if retStmt == nil || retStmt.Expression == nil {
    return
  }
  if !isClassLiteralPropertyValue(retStmt.Expression) {
    return
  }
  name := classMemberName(node)
  if name == "" {
    return
  }
  if classHasSetterFor(parent, name) {
    return
  }
  ctx.Report(node, "Literal-returning getter `"+name+"` should be a `readonly` field instead.")
}

// isClassLiteralPropertyValue reports whether the expression is one of
// the literal shapes the rule accepts: a plain literal, a template
// literal without substitutions, or a unary-minus prefix on a numeric
// literal.
func isClassLiteralPropertyValue(expr *shimast.Node) bool {
  if expr == nil {
    return false
  }
  switch expr.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword,
    shimast.KindNoSubstitutionTemplateLiteral:
    return true
  case shimast.KindPrefixUnaryExpression:
    prefix := expr.AsPrefixUnaryExpression()
    if prefix == nil || prefix.Operator != shimast.KindMinusToken || prefix.Operand == nil {
      return false
    }
    return prefix.Operand.Kind == shimast.KindNumericLiteral
  }
  return false
}

// classHasSetterFor reports whether the class contains a `set`
// accessor whose name matches `name`. A getter paired with a setter
// is left alone because the field form cannot reproduce the setter's
// side effects.
func classHasSetterFor(class *shimast.Node, name string) bool {
  for _, member := range classMembers(class) {
    if member == nil || member.Kind != shimast.KindSetAccessor {
      continue
    }
    if classMemberName(member) == name {
      return true
    }
  }
  return false
}

func init() {
  Register(classLiteralPropertyStyle{})
}
