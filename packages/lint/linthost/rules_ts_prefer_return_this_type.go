// typescript/prefer-return-this-type: when an instance method always
// `return this`, declare its return type as `this` instead of the
// enclosing class name. The `this` polymorphic-receiver type keeps the
// narrower subclass type at the call site so chained calls stay
// polymorphic: `subclass.fluent().subclassOnly()` only type-checks if
// `fluent()` is declared `: this` rather than `: Base`.
// typescript-eslint:
// https://typescript-eslint.io/rules/prefer-return-this-type/
//
// Type-aware. Without a Checker the rule cannot read the method's
// declared return type or distinguish the class symbol, so
// Context.Checker == nil short-circuits each Check to a no-op the way
// other type-aware rules do.
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
//   - methods that have at least one `return X;` where `X` is not the
//     `this` keyword.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

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
  // Walk the method body. Every value-returning `return` must
  // return exactly `this`; we also require at least one return
  // statement so we don't fire on methods that fall off the end.
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
//   - allAreThis: every value-returning `return` returns the bare
//     `this` keyword (after stripping parens).
//
// A bare `return;` is ignored — it returns `undefined`, which the rule
// cannot rewrite to `this` regardless. The conservative interpretation
// matches the upstream rule's behavior.
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
      if ret != nil && ret.Expression != nil {
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
