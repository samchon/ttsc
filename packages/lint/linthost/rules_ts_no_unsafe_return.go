// typescript/no-unsafe-return: a `return X;` whose expression carries
// the `any` type from a function whose declared return shape is
// concrete leaks `any` past the type boundary. Callers see the declared
// shape, lose every downstream type check on the value, and the bug
// that introduced the `any` migrates to whichever site reads the result.
// typescript-eslint:
// https://typescript-eslint.io/rules/no-unsafe-return/
//
// Type-aware. Without a Checker we cannot tell `any` apart from a
// concrete shape, so Context.Checker == nil short-circuits the visit
// the same way `no-floating-promises` and `restrict-plus-operands` do.
//
// The rule walks each `return` to its enclosing function-like
// declaration, asks the Checker for that function's signature, and
// compares the declared return type against the expression type:
//
//   - the expression must be `any`-typed (raw `any`, not `unknown`);
//   - the declared return type must be concrete — `any`, `unknown`, and
//     `void` are deliberately exempt because they advertise the same
//     looseness at the boundary and a strict rejection would explode
//     on every generic helper that propagates `unknown`.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noUnsafeReturn struct{}

func (noUnsafeReturn) Name() string { return "typescript/no-unsafe-return" }
func (noUnsafeReturn) NeedsTypeChecker() bool {
  return true
}
func (noUnsafeReturn) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindReturnStatement}
}
func (noUnsafeReturn) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  ret := node.AsReturnStatement()
  if ret == nil || ret.Expression == nil {
    return
  }
  fn := noUnsafeReturnEnclosingFunction(node)
  if fn == nil {
    return
  }
  sig := ctx.Checker.GetSignatureFromDeclaration(fn)
  if sig == nil {
    return
  }
  declared := ctx.Checker.GetReturnTypeOfSignature(sig)
  if declared == nil {
    return
  }
  if !noUnsafeReturnIsConcrete(declared) {
    return
  }
  exprType := ctx.Checker.GetTypeAtLocation(ret.Expression)
  if exprType == nil {
    return
  }
  if !noUnsafeReturnIsAny(exprType) {
    return
  }
  ctx.Report(ret.Expression, "Unsafe return of `any` value from function with a concrete declared return type. The `any` leaks past the type boundary and disables downstream type checks.")
}

// noUnsafeReturnEnclosingFunction walks up the parent chain to the
// nearest function-like declaration that owns this `return`. Nested
// functions establish their own return scope, so the walk stops at the
// first function-like ancestor — mirroring the `consistent-return`
// scope rule already established in this package.
func noUnsafeReturnEnclosingFunction(node *shimast.Node) *shimast.Node {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    if isFunctionLikeKind(cur) {
      return cur
    }
  }
  return nil
}

// noUnsafeReturnIsConcrete reports whether the declared return type is
// strict enough to be worth protecting. `any`, `unknown`, and `void`
// are the three shapes that explicitly advertise looseness — the
// upstream rule exempts them so generic helpers that propagate
// `unknown` and side-effect functions that return `void` do not light
// up everywhere. Unions are concrete only when every constituent is.
func noUnsafeReturnIsConcrete(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  flags := t.Flags()
  if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsVoid) != 0 {
    return false
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if !noUnsafeReturnIsConcrete(part) {
        return false
      }
    }
    return true
  }
  return true
}

// noUnsafeReturnIsAny reports whether t is the raw `any` type. The
// upstream rule treats `unknown` as a safe escape hatch — values
// returned as `unknown` cannot be used without further narrowing, so
// they don't leak silently — and only flags the lossy `any` case.
func noUnsafeReturnIsAny(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  return t.Flags()&shimchecker.TypeFlagsAny != 0
}

func init() {
  Register(noUnsafeReturn{})
}
