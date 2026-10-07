// noUselessConstructor: report class constructors that contribute
// nothing beyond what the engine would synthesize on its own. Two
// shapes fire:
//
//   - Empty base constructor, no parameters, no restricted visibility or
//     decorator effects. A derived empty body is not this shape: its implicit
//     constructor would invoke super with every caller argument.
//
//   - Derived constructor that does nothing but forward to `super(...args)`
//     unchanged. The default constructor of a subclass already forwards
//     every argument to `super`, so an explicit `constructor(...args) {
//     super(...args); }` is redundant. The forwarded parameter list and
//     the `super` call's argument list must be identical rest-spreads of
//     the same name — modifying, reordering, or filtering the arguments
//     means the constructor still has a purpose and is left alone.
//
// Constructors that carry parameter properties (`constructor(private x:
// number)`), restricted visibility or decorator effects are skipped: removing
// them would change the class shape or its observable metadata, so they
// are never "useless" by this rule's standard.
// https://typescript-eslint.io/rules/no-useless-constructor/
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noUselessConstructor detects empty base construction and unchanged derived
// rest forwarding. Fixed argument lists have meaning even when each declared
// parameter is passed through, because they filter additional caller arguments.
type noUselessConstructor struct{}

func (noUselessConstructor) Name() string           { return "no-useless-constructor" }
func (noUselessConstructor) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindConstructor} }
func (noUselessConstructor) Check(ctx *Context, node *shimast.Node) {
  ctor := node.AsConstructorDeclaration()
  if ctor == nil || ctor.Body == nil {
    return
  }
  // Accessibility modifiers (`private`/`protected`) on the constructor
  // itself are load-bearing: they restrict who can `new` the class.
  // Removing the constructor would silently widen visibility.
  if node.ModifierFlags()&(shimast.ModifierFlagsPrivate|shimast.ModifierFlagsProtected) != 0 || len(node.Decorators()) != 0 {
    return
  }
  if hasParameterProperty(node) {
    return
  }
  body := ctor.Body.AsBlock()
  if body == nil || body.Statements == nil {
    return
  }
  params := node.Parameters()

  // Shape 1 is an empty base constructor. Derived classes require the separate
  // all-argument forwarding check below.
  if len(params) == 0 && len(body.Statements.Nodes) == 0 && !classExtendsAnother(node.Parent) {
    ctx.Report(node, "Useless empty constructor.")
    return
  }

  // Shape 2: derived class constructor that only forwards arguments to
  // `super(...args)` without modification. This is a forwarding syntax policy:
  // the synthetic derived constructor forwards all arguments directly, while
  // explicit rest spread also observes the array iterator.
  parent := node.Parent
  if parent == nil || !classExtendsAnother(parent) {
    return
  }
  if len(body.Statements.Nodes) != 1 {
    return
  }
  if !isPlainSuperForwarder(params, body.Statements.Nodes[0]) {
    return
  }
  ctx.Report(node, "Useless constructor: forwards arguments to `super` unchanged.")
}

// hasParameterProperty reports whether any constructor parameter carries
// TypeScript's canonical parameter-property modifier flag. Such parameters
// declare instance fields, so the constructor is doing real work even if its body is
// empty — removing it would drop the field.
func hasParameterProperty(node *shimast.Node) bool {
  for _, p := range node.Parameters() {
    if p == nil {
      continue
    }
    if p.ModifierFlags()&shimast.ModifierFlagsParameterPropertyModifier != 0 {
      return true
    }
  }
  return false
}

// isPlainSuperForwarder reports whether `stmt` is exactly
// `super(...name);` (an expression statement wrapping a CallExpression
// whose callee is the `super` keyword and whose only argument is a
// SpreadElement over an identifier) AND the constructor parameter list
// is exactly `(...name)` over the same identifier. Type annotations on
// the rest parameter are allowed — `(...args: unknown[])` still
// forwards unchanged.
func isPlainSuperForwarder(params []*shimast.Node, stmt *shimast.Node) bool {
  if stmt == nil || stmt.Kind != shimast.KindExpressionStatement {
    return false
  }
  exprStmt := stmt.AsExpressionStatement()
  if exprStmt == nil || exprStmt.Expression == nil {
    return false
  }
  expr := stripParens(exprStmt.Expression)
  if expr == nil || expr.Kind != shimast.KindCallExpression {
    return false
  }
  call := expr.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindSuperKeyword {
    return false
  }
  if call.Arguments == nil {
    return false
  }
  args := call.Arguments.Nodes
  // Only a single rest parameter preserves every caller argument. Zero or
  // fixed positional parameters filter additional arguments; even a fixed
  // prefix plus a rest changes missing arguments into explicit undefined.
  if len(args) != 1 || len(params) != 1 {
    return false
  }
  // The one spread must refer to the one rest parameter.
  for i, arg := range args {
    paramName, paramRest, ok := plainParamIdentifier(params[i])
    if !ok {
      return false
    }
    argName, argSpread, ok := plainArgIdentifier(arg)
    if !ok {
      return false
    }
    if paramName != argName {
      return false
    }
    if !paramRest || !argSpread {
      return false
    }
  }
  return true
}

// plainParamIdentifier extracts the identifier name of a parameter that
// is a plain `name` or `...name`. Returns `(name, isRest, true)` on
// match, or zero values + false when the parameter is a destructuring
// pattern, has a default value, has an accessibility modifier, has a
// `?` token (optional), or otherwise carries observable behavior.
// Type annotations are intentionally ignored — they do not change the
// runtime forwarding behavior.
func plainParamIdentifier(param *shimast.Node) (string, bool, bool) {
  if param == nil {
    return "", false, false
  }
  decl := param.AsParameterDeclaration()
  if decl == nil {
    return "", false, false
  }
  if decl.Initializer != nil || decl.QuestionToken != nil {
    return "", false, false
  }
  // A parameter-property modifier would already have been caught by
  // hasParameterProperty above, but guard locally too.
  if param.ModifierFlags()&shimast.ModifierFlagsParameterPropertyModifier != 0 || len(param.Decorators()) != 0 {
    return "", false, false
  }
  name := identifierText(decl.Name())
  if name == "" {
    return "", false, false
  }
  return name, decl.DotDotDotToken != nil, true
}

// plainArgIdentifier extracts the identifier name of a call argument
// that is a plain `name` or `...name`. Returns `(name, isSpread, true)`
// on match. Anything else — a literal, property access, expression —
// is treated as observable work and disqualifies the forwarder.
func plainArgIdentifier(arg *shimast.Node) (string, bool, bool) {
  if arg == nil {
    return "", false, false
  }
  stripped := stripParens(arg)
  if stripped == nil {
    return "", false, false
  }
  if stripped.Kind == shimast.KindSpreadElement {
    spread := stripped.AsSpreadElement()
    if spread == nil {
      return "", false, false
    }
    inner := stripParens(spread.Expression)
    name := identifierText(inner)
    if name == "" {
      return "", false, false
    }
    return name, true, true
  }
  name := identifierText(stripped)
  if name == "" {
    return "", false, false
  }
  return name, false, true
}

func init() {
  Register(noUselessConstructor{})
}
