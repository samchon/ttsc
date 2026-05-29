// noUselessConstructor: report class constructors that contribute
// nothing beyond what the engine would synthesize on its own. Two
// shapes fire:
//
//   - Empty body, no parameters, no accessibility/decorator modifiers.
//     The engine generates an identical implicit constructor when the
//     class declares none, so the explicit declaration is pure noise.
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
// number)`) or accessibility / decorator modifiers are skipped: removing
// them would change the class shape or its observable metadata, so they
// are never "useless" by this rule's standard.
// https://typescript-eslint.io/rules/no-useless-constructor/
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

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
  if node.ModifierFlags()&(shimast.ModifierFlagsPrivate|shimast.ModifierFlagsProtected) != 0 {
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

  // Shape 1: empty body, no parameters. The implicit constructor that
  // the engine generates when no constructor is written is identical,
  // so the explicit declaration is noise.
  if len(params) == 0 && len(body.Statements.Nodes) == 0 {
    ctx.Report(node, "Useless empty constructor.")
    return
  }

  // Shape 2: derived class constructor that only forwards arguments to
  // `super(...args)` without modification. The synthetic default
  // constructor of a subclass behaves identically, so the explicit
  // declaration is noise. Only fires when the class extends another.
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
// a TypeScript parameter-property modifier (`public`, `private`,
// `protected`, or `readonly`). Such a parameter declares an instance
// field, so the constructor is doing real work even if its body is
// empty — removing it would drop the field.
func hasParameterProperty(node *shimast.Node) bool {
  for _, p := range node.Parameters() {
    if p == nil {
      continue
    }
    if p.ModifierFlags()&(shimast.ModifierFlagsPrivate|shimast.ModifierFlagsProtected|shimast.ModifierFlagsReadonly) != 0 {
      return true
    }
    // `public` is not represented by any of the above flags but does
    // still create a parameter property. Inspect the raw modifier
    // list for a PublicKeyword.
    decl := p.AsParameterDeclaration()
    if decl == nil {
      continue
    }
    if hasPublicModifier(decl.Modifiers()) {
      return true
    }
  }
  return false
}

// hasPublicModifier reports whether `mods` includes a `public` keyword.
// `public` is a parameter-property qualifier that does not set any of
// the Private/Protected/Readonly modifier flags, so we walk the raw
// modifier list to detect it.
func hasPublicModifier(mods *shimast.ModifierList) bool {
  if mods == nil {
    return false
  }
  for _, m := range mods.Nodes {
    if m != nil && m.Kind == shimast.KindPublicKeyword {
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
  // `super()` — zero arguments — only matches when the constructor
  // also declares zero parameters. ESLint flags this shape too: the
  // synthetic default constructor of a derived class would call
  // `super(...args)`, which for a zero-arg case is the same thing.
  if len(args) == 0 {
    return len(params) == 0
  }
  if len(args) != len(params) {
    return false
  }
  // All arguments must be `...name` spreading the identically named
  // rest parameter. ESLint also accepts the positional `super(a, b)`
  // over `(a, b)` shape — match that too: every parameter must be a
  // plain identifier (or rest), and the argument must spread/use the
  // same identifier in the same position.
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
    if paramRest != argSpread {
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
  // Accessibility modifier on the parameter would already have been
  // caught by hasParameterProperty above, but guard locally too.
  if param.ModifierFlags()&(shimast.ModifierFlagsPrivate|shimast.ModifierFlagsProtected|shimast.ModifierFlagsReadonly) != 0 {
    return "", false, false
  }
  if hasPublicModifier(decl.Modifiers()) {
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
