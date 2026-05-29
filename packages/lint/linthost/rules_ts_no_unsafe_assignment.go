// typescript/no-unsafe-assignment: assigning an `any`-typed value into
// a concretely typed location erases the static guarantee the target
// declaration carries. `const num: number = anyValue;` compiles, but
// every later use of `num` operates on whatever `anyValue` actually
// holds at runtime. typescript-eslint:
// https://typescript-eslint.io/rules/no-unsafe-assignment/
//
// Type-aware. The rule visits two shapes:
//
//   - `VariableDeclaration` — the initializer of `let x: T = ...` or
//     `const x: T = ...`. Without a typed target the assignment is
//     trivially safe (the local becomes `any` too), so the rule
//     requires an explicit type annotation OR a target that resolves
//     to a non-`any` type.
//   - `BinaryExpression` with `=` operator — a plain reassignment like
//     `x = anyValue`. The LHS already has a static type from its
//     declaration; the rule fires when the RHS is `any` and the LHS is
//     not.
//
// As with the rest of the unsafe-* family `unknown` is intentionally
// NOT flagged: it forces a narrowing assertion before the value can be
// stored in a typed slot, which is the explicit ergonomic the upstream
// rule pushes toward.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noUnsafeAssignment struct{}

func (noUnsafeAssignment) Name() string { return "typescript/no-unsafe-assignment" }
func (noUnsafeAssignment) NeedsTypeChecker() bool {
  return true
}
func (noUnsafeAssignment) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindVariableDeclaration,
    shimast.KindBinaryExpression,
  }
}
func (noUnsafeAssignment) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  switch node.Kind {
  case shimast.KindVariableDeclaration:
    decl := node.AsVariableDeclaration()
    if decl == nil || decl.Initializer == nil {
      return
    }
    // Only flag when the target has an explicit type annotation —
    // `const x = anyValue;` widens `x` to `any` too, which is the
    // `no-explicit-any` family's concern, not this rule's.
    if decl.Type == nil {
      return
    }
    rhs := stripParens(decl.Initializer)
    if rhs == nil {
      return
    }
    rhsType := ctx.Checker.GetTypeAtLocation(rhs)
    if !typeIsUnsafeAny(rhsType) {
      return
    }
    lhsType := ctx.Checker.GetTypeFromTypeNode(decl.Type)
    if typeIsUnsafeAny(lhsType) {
      return
    }
    ctx.Report(node, noUnsafeAssignmentMessage)
  case shimast.KindBinaryExpression:
    bin := node.AsBinaryExpression()
    if bin == nil || bin.OperatorToken == nil {
      return
    }
    if bin.OperatorToken.Kind != shimast.KindEqualsToken {
      return
    }
    if bin.Left == nil || bin.Right == nil {
      return
    }
    rhs := stripParens(bin.Right)
    if rhs == nil {
      return
    }
    rhsType := ctx.Checker.GetTypeAtLocation(rhs)
    if !typeIsUnsafeAny(rhsType) {
      return
    }
    lhsType := ctx.Checker.GetTypeAtLocation(bin.Left)
    if typeIsUnsafeAny(lhsType) {
      return
    }
    ctx.Report(node, noUnsafeAssignmentMessage)
  }
}

const noUnsafeAssignmentMessage = "Unsafe assignment of a value typed as `any` to a typed target. Narrow the value before storing it."

func init() {
  Register(noUnsafeAssignment{})
}
