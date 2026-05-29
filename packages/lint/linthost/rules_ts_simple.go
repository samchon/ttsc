// Additional AST-only `typescript/*` rules from
// typescript-eslint. Each rule is a small pattern match — no Checker,
// no scope analysis — and corresponds 1:1 with the upstream rule of
// the same name.
//
// Implemented here:
//   - typescript/no-array-for-each
//   - typescript/no-extraneous-class
//   - typescript/no-invalid-void-type
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noArrayForEach reports `arr.forEach(...)` calls and suggests
// `for ... of` instead. The for-of form supports early termination
// (`break`/`return`) and `await`, while `forEach` swallows both. The
// rule does not confirm that the receiver is actually an array — the
// syntactic shape is the signal, matching the upstream rule's behavior.
// https://typescript-eslint.io/rules/no-array-for-each/
type noArrayForEach struct{}

func (noArrayForEach) Name() string { return "typescript/no-array-for-each" }
func (noArrayForEach) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (noArrayForEach) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  _, method, ok := promisePropertyAccessParts(call.Expression)
  if !ok || method != "forEach" {
    return
  }
  ctx.Report(node, "Prefer `for ... of` over `Array.forEach()` — `forEach` does not support `await` or `break`.")
}

// noExtraneousClass reports class declarations that exist purely as a
// namespace for static members or are entirely empty. A namespace
// import or a plain function is almost always clearer than `class Util
// { static foo() { … } }`, and the class adds a layer of indirection
// without providing any instance behavior.
// https://typescript-eslint.io/rules/no-extraneous-class/
//
// Trigger:
//   - the class has no `extends` heritage,
//   - no constructor with a non-empty body, and
//   - every member is `static` (or the class has no members at all).
type noExtraneousClass struct{}

func (noExtraneousClass) Name() string { return "typescript/no-extraneous-class" }
func (noExtraneousClass) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindClassDeclaration, shimast.KindClassExpression}
}
func (noExtraneousClass) Check(ctx *Context, node *shimast.Node) {
  if classExtendsAnother(node) {
    return
  }
  if classImplementsAnInterface(node) {
    return
  }
  members := classMembers(node)
  if len(members) == 0 {
    ctx.Report(node, "Empty class — prefer a plain function or namespace.")
    return
  }
  hasInstanceMember := false
  hasNonTrivialConstructor := false
  for _, member := range members {
    if member == nil {
      continue
    }
    if member.Kind == shimast.KindConstructor {
      ctor := member.AsConstructorDeclaration()
      if ctor != nil && ctor.Body != nil && len(ctor.Body.Statements()) > 0 {
        hasNonTrivialConstructor = true
      }
      continue
    }
    if !hasModifier(member, shimast.KindStaticKeyword) {
      hasInstanceMember = true
      break
    }
  }
  if !hasInstanceMember && !hasNonTrivialConstructor {
    ctx.Report(node, "Class only declares static members — prefer a namespace or top-level functions.")
  }
}

// classImplementsAnInterface reports whether the class has an
// `implements …` heritage clause. Classes that implement an interface
// are intentionally polymorphic at runtime, so noExtraneousClass
// should not fire on them.
func classImplementsAnInterface(class *shimast.Node) bool {
  var clauses []*shimast.Node
  switch class.Kind {
  case shimast.KindClassDeclaration:
    decl := class.AsClassDeclaration()
    if decl == nil || decl.HeritageClauses == nil {
      return false
    }
    clauses = decl.HeritageClauses.Nodes
  case shimast.KindClassExpression:
    expr := class.AsClassExpression()
    if expr == nil || expr.HeritageClauses == nil {
      return false
    }
    clauses = expr.HeritageClauses.Nodes
  default:
    return false
  }
  for _, clause := range clauses {
    if clause == nil {
      continue
    }
    hc := clause.AsHeritageClause()
    if hc == nil || hc.Token != shimast.KindImplementsKeyword {
      continue
    }
    if hc.Types != nil && len(hc.Types.Nodes) > 0 {
      return true
    }
  }
  return false
}

// noInvalidVoidType reports a `void` type used as a union constituent
// or as a generic-type argument. `void` is meaningful only as the sole
// return type of a function — `void | string` and `Promise<void>` are
// fine, but `string | void` is almost always a confusion with
// `undefined`.
// https://typescript-eslint.io/rules/no-invalid-void-type/
//
// Allowed positions:
//   - the return type annotation of a function-like (Function/Method/
//     Arrow/Constructor/CallSignature/MethodSignature/FunctionType);
//   - inside `Promise<void>`, `Generator<void, …, …>`, etc. — these
//     are the established generic exceptions in typescript-eslint.
type noInvalidVoidType struct{}

func (noInvalidVoidType) Name() string { return "typescript/no-invalid-void-type" }
func (noInvalidVoidType) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVoidKeyword}
}
func (noInvalidVoidType) Check(ctx *Context, node *shimast.Node) {
  // The `void` keyword shows up both as a type node and as the unary
  // `void X` expression operator. Filter by parent kind — the
  // expression operator's parent is VoidExpression, not a type position.
  parent := node.Parent
  if parent == nil || parent.Kind == shimast.KindVoidExpression {
    return
  }
  if isValidVoidPosition(node) {
    return
  }
  ctx.Report(node, "`void` is only valid as the return type annotation of a function or as a known generic argument.")
}

// isValidVoidPosition reports whether a `void` type node sits in one
// of the approved positions: a function return type or an
// allow-listed generic type argument (Promise/Generator/AsyncGenerator/
// Iterator/AsyncIterator/IterableIterator).
func isValidVoidPosition(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindMethodSignature,
    shimast.KindConstructor,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindCallSignature,
    shimast.KindConstructSignature,
    shimast.KindFunctionType,
    shimast.KindConstructorType,
    shimast.KindIndexSignature:
    return parent.Type() == node
  case shimast.KindTypeReference:
    // `void` as a generic argument — allowed inside the typescript-
    // eslint approved set.
    grand := parent.Parent
    if grand == nil {
      return false
    }
    if grand.Kind == shimast.KindTypeReference {
      ref := grand.AsTypeReferenceNode()
      if ref == nil {
        return false
      }
      name := identifierText(ref.TypeName)
      switch name {
      case "Promise", "Generator", "AsyncGenerator", "Iterator", "AsyncIterator", "IterableIterator", "AsyncIterableIterator":
        return true
      }
    }
  }
  // Walk up: if the parent chain leads directly to an allow-listed
  // generic type reference's typeArguments list, accept.
  for cur := parent; cur != nil; cur = cur.Parent {
    if cur.Kind == shimast.KindTypeReference {
      ref := cur.AsTypeReferenceNode()
      if ref == nil {
        return false
      }
      name := identifierText(ref.TypeName)
      switch name {
      case "Promise", "Generator", "AsyncGenerator", "Iterator", "AsyncIterator", "IterableIterator", "AsyncIterableIterator":
        return true
      }
      return false
    }
    // Stop walking past statement boundaries — `void` in
    // `let x: string | void;` should still fire.
    switch cur.Kind {
    case shimast.KindVariableDeclaration,
      shimast.KindParameter,
      shimast.KindPropertyDeclaration,
      shimast.KindPropertySignature:
      return false
    }
  }
  return false
}

// explicitMemberAccessibility requires every class member declaration
// to carry a `public` / `private` / `protected` modifier. Implicit
// public is permitted by TypeScript but obscures intent — explicit
// keywords make the encapsulation contract self-documenting and
// catch the common bug of "I forgot to make this private."
// https://typescript-eslint.io/rules/explicit-member-accessibility/
//
// Class fields whose name starts with `#` are exempt — the private
// hash already carries the same meaning. The constructor is exempt;
// upstream allows omitting accessibility on the constructor itself.
type explicitMemberAccessibility struct{}

func (explicitMemberAccessibility) Name() string {
  return "typescript/explicit-member-accessibility"
}
func (explicitMemberAccessibility) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindMethodDeclaration,
    shimast.KindPropertyDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
  }
}
func (explicitMemberAccessibility) Check(ctx *Context, node *shimast.Node) {
  // Skip non-class-scoped members.
  parent := node.Parent
  if parent == nil ||
    (parent.Kind != shimast.KindClassDeclaration && parent.Kind != shimast.KindClassExpression) {
    return
  }
  // Skip private hash identifiers.
  if name := node.Name(); name != nil && name.Kind == shimast.KindPrivateIdentifier {
    return
  }
  if classMemberHasAccessibility(node) {
    return
  }
  ctx.Report(node, "Class member is missing an explicit accessibility modifier (`public`, `private`, or `protected`).")
}

// classMemberHasAccessibility reports whether the member carries an
// explicit `public` / `private` / `protected` modifier.
func classMemberHasAccessibility(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  mods := node.Modifiers()
  if mods == nil {
    return false
  }
  for _, m := range mods.Nodes {
    if m == nil {
      continue
    }
    switch m.Kind {
    case shimast.KindPublicKeyword,
      shimast.KindPrivateKeyword,
      shimast.KindProtectedKeyword:
      return true
    }
  }
  return false
}

// consistentGenericConstructors reports the redundant pattern where a
// variable is annotated with a generic type AND the same generic
// arguments are repeated on the constructor call:
//
//  const m: Map<string, number> = new Map<string, number>();
//
// One of the two type-argument lists is enough. The upstream default
// prefers the constructor form; the annotation form is also valid but
// stating both is noise.
// https://typescript-eslint.io/rules/consistent-generic-constructors/
type consistentGenericConstructors struct{}

func (consistentGenericConstructors) Name() string {
  return "typescript/consistent-generic-constructors"
}
func (consistentGenericConstructors) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableDeclaration}
}
func (consistentGenericConstructors) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsVariableDeclaration()
  if decl == nil || decl.Type == nil || decl.Initializer == nil {
    return
  }
  if decl.Type.Kind != shimast.KindTypeReference {
    return
  }
  typeRef := decl.Type.AsTypeReferenceNode()
  if typeRef == nil || typeRef.TypeArguments == nil {
    return
  }
  initializer := stripParens(decl.Initializer)
  if initializer == nil || initializer.Kind != shimast.KindNewExpression {
    return
  }
  ne := initializer.AsNewExpression()
  if ne == nil || ne.TypeArguments == nil {
    return
  }
  ctx.Report(initializer, "Redundant generic arguments — the annotation already pins the type parameters; drop them from the constructor or vice versa.")
}

// preferNumericLiterals reports `parseInt(literal, radix)` calls that
// could be written as an ES2015+ numeric literal (binary `0b…`, octal
// `0o…`, hex `0x…`). The literal form is shorter, type-safe, and not
// subject to runtime radix mismatches.
// https://eslint.org/docs/latest/rules/prefer-numeric-literals
type preferNumericLiterals struct{}

func (preferNumericLiterals) Name() string { return "prefer-numeric-literals" }
func (preferNumericLiterals) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (preferNumericLiterals) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Arguments == nil {
    return
  }
  calleeName := identifierText(call.Expression)
  if calleeName != "parseInt" && calleeName != "Number" {
    return
  }
  args := call.Arguments.Nodes
  if calleeName == "parseInt" && len(args) != 2 {
    return
  }
  if calleeName == "Number" && len(args) != 1 {
    return
  }
  first := stripParens(args[0])
  if first == nil || first.Kind != shimast.KindStringLiteral {
    return
  }
  if calleeName == "parseInt" {
    radix := stripParens(args[1])
    if radix == nil || radix.Kind != shimast.KindNumericLiteral {
      return
    }
    switch numericLiteralText(radix) {
    case "2", "8", "16":
      ctx.Report(node, "Use a numeric literal (`0b…` / `0o…` / `0x…`) instead of `parseInt(\""+stringLiteralText(first)+"\", "+numericLiteralText(radix)+")`.")
    }
  }
}

func init() {
  Register(noArrayForEach{})
  Register(noExtraneousClass{})
  Register(noInvalidVoidType{})
  Register(explicitMemberAccessibility{})
  Register(consistentGenericConstructors{})
  Register(preferNumericLiterals{})
}
