// typescript/prefer-return-this-type: when an instance method always
// `return this`, declare its return type as `this` instead of the
// enclosing class name. The `this` polymorphic-receiver type keeps the
// narrower subclass type at the call site so chained calls stay
// polymorphic: `subclass.fluent().subclassOnly()` only type-checks if
// `fluent()` is declared `: this` rather than `: Base`.
// typescript-eslint:
// https://typescript-eslint.io/rules/prefer-return-this-type/
//
// Requires a bound Program through the Checker-aware Engine. The compiler's
// reachability flags distinguish implicit undefined returns from complete
// branches; an unbound parser-only AST cannot establish that distinction.
// Explicit annotation syntax and returned expressions are inspected directly.
//
// Skipped:
//   - methods whose return type is already `this`;
//   - methods without an explicit declared return type (the upstream
//     rule only proposes a narrower annotation when one is already
//     present — adding a brand-new annotation is the job of
//     `explicit-function-return-type`);
//   - constructors, accessors, generators, and `async` methods (each
//     has return-shape semantics the `this` rewrite does not preserve);
//   - methods with no body (overload signatures, abstract members);
//   - methods with reachable fallthrough, a bare return, or a returned
//     expression other than the `this` keyword.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// preferReturnThisType narrows explicit fluent annotations only when no normal
// completion falls through or returns a value other than this. The bound
// compiler owns reachability; nested functions retain their own return scope.
type preferReturnThisType struct{}

func (preferReturnThisType) Name() string { return "typescript/prefer-return-this-type" }
func (preferReturnThisType) NeedsTypeChecker() bool {
  return true
}
func (preferReturnThisType) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindMethodDeclaration}
}
func (preferReturnThisType) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  decl := node.AsMethodDeclaration()
  if decl == nil || decl.Body == nil {
    return
  }
  // Skip async / generator methods — their return shape is wrapped
  // (`Promise<...>` / `Generator<...>`) and not directly `this`.
  if hasAsyncModifier(node) {
    return
  }
  if decl.AsteriskToken != nil {
    return
  }
  // Skip static methods — the upstream rule targets instance-method
  // chains where the receiver type is the subclass; static dispatch
  // uses the class itself and `this` rewriting changes nothing.
  if hasModifier(node, shimast.KindStaticKeyword) {
    return
  }
  // The method must have an explicit return-type annotation that is
  // NOT already `this`. The rewrite-target is the existing annotation;
  // without one, adding `this` would force a new annotation that the
  // upstream rule does not propose.
  if decl.Type == nil {
    return
  }
  if decl.Type.Kind == shimast.KindThisType {
    return
  }
  // The enclosing class must exist — the rule applies to instance
  // methods of class declarations / expressions only.
  parent := node.Parent
  if parent == nil {
    return
  }
  if parent.Kind != shimast.KindClassDeclaration &&
    parent.Kind != shimast.KindClassExpression {
    return
  }
  // The bound compiler's reachability flag owns fallthrough, including
  // conditional and try/finally paths. Finding a return is not proof that
  // every normal completion returns a value.
  if node.Flags&shimast.NodeFlagsHasImplicitReturn != 0 {
    return
  }
  hasValueReturn, allAreThis := preferReturnThisTypeAnalyzeBody(decl.Body)
  if !hasValueReturn || !allAreThis {
    return
  }
  ctx.Report(decl.Type, preferReturnThisTypeMessage)
}

const preferReturnThisTypeMessage = "Method always returns `this` — declare the return type as `this` so subclass call sites keep the narrower receiver type."

// preferReturnThisTypeAnalyzeBody walks the method body (without
// descending into nested function-like scopes) and reports:
//   - hasValueReturn: at least one `return <expression>;` exists.
//   - allAreThis: no bare return exists and every value return is the
//     `this` keyword (after stripping parens).
//
// A bare return produces undefined and rejects the preference, including
// returns in finally blocks. Nested functions retain their own return scope.
func preferReturnThisTypeAnalyzeBody(body *shimast.Node) (hasValueReturn, allAreThis bool) {
  allAreThis = true
  var walk func(*shimast.Node)
  walk = func(n *shimast.Node) {
    if n == nil {
      return
    }
    if n != body && isFunctionLikeKind(n) {
      return
    }
    if n.Kind == shimast.KindReturnStatement {
      ret := n.AsReturnStatement()
      if ret == nil || ret.Expression == nil {
        allAreThis = false
      } else {
        hasValueReturn = true
        inner := stripParens(ret.Expression)
        if inner == nil || inner.Kind != shimast.KindThisKeyword {
          allAreThis = false
        }
      }
    }
    n.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(body)
  return hasValueReturn, allAreThis
}

func init() {
  Register(preferReturnThisType{})
}
