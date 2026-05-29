// typescript/no-unsafe-member-access: reading a property off a value
// whose static type is `any` silently yields another `any`, and the
// next operation on that result is unchecked too. `x.foo.bar.baz` is
// the cascade that lets a single `any` propagate through an entire
// expression tree. typescript-eslint:
// https://typescript-eslint.io/rules/no-unsafe-member-access/
//
// Type-aware. The rule visits dotted access (`x.foo`) and computed
// access (`x[k]`) and reports when the receiver resolves to `any`. As
// with the rest of the unsafe-* family `unknown` is intentionally NOT
// flagged: it forces a narrowing assertion before the access, which is
// the explicit ergonomic the upstream rule pushes toward.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noUnsafeMemberAccess struct{}

func (noUnsafeMemberAccess) Name() string { return "typescript/no-unsafe-member-access" }
func (noUnsafeMemberAccess) NeedsTypeChecker() bool {
  return true
}
func (noUnsafeMemberAccess) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindPropertyAccessExpression,
    shimast.KindElementAccessExpression,
  }
}
func (noUnsafeMemberAccess) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  var receiver *shimast.Node
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    if access := node.AsPropertyAccessExpression(); access != nil {
      receiver = access.Expression
    }
  case shimast.KindElementAccessExpression:
    if access := node.AsElementAccessExpression(); access != nil {
      receiver = access.Expression
    }
  }
  if receiver == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(receiver)
  if !typeIsUnsafeAny(t) {
    return
  }
  ctx.Report(node, "Unsafe member access on a value typed as `any`. Narrow the receiver to a concrete type before reading a property.")
}

func init() {
  Register(noUnsafeMemberAccess{})
}
