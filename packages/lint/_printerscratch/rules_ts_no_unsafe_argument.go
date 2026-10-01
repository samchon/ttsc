// typescript/no-unsafe-argument: passing an `any`-typed value into a
// concretely typed parameter discards every static check the function's
// signature would otherwise enforce. The call still runs, but the value
// flows in unchecked and downstream uses operate on whatever the
// runtime actually supplies. typescript-eslint:
// https://typescript-eslint.io/rules/no-unsafe-argument/
//
// Type-aware. The rule visits `CallExpression` and `NewExpression` and
// reports each argument whose static type carries `TypeFlagsAny` when
// the callee's resolved type is itself a concrete (non-`any`) callable.
// `unknown` is intentionally NOT flagged: it forces a narrowing
// assertion before the call, which is the explicit ergonomic the
// upstream rule pushes toward.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noUnsafeArgument struct{}

func (noUnsafeArgument) Name() string { return "typescript/no-unsafe-argument" }
func (noUnsafeArgument) NeedsTypeChecker() bool {
  return true
}
func (noUnsafeArgument) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindCallExpression,
    shimast.KindNewExpression,
  }
}
func (noUnsafeArgument) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  var callee *shimast.Node
  var args []*shimast.Node
  switch node.Kind {
  case shimast.KindCallExpression:
    if call := node.AsCallExpression(); call != nil {
      callee = call.Expression
      if call.Arguments != nil {
        args = call.Arguments.Nodes
      }
    }
  case shimast.KindNewExpression:
    if ne := node.AsNewExpression(); ne != nil {
      callee = ne.Expression
      if ne.Arguments != nil {
        args = ne.Arguments.Nodes
      }
    }
  }
  if callee == nil || len(args) == 0 {
    return
  }
  calleeType := ctx.Checker.GetTypeAtLocation(callee)
  if calleeType == nil || typeIsUnsafeAny(calleeType) {
    // Callee itself is `any` — no-unsafe-call handles that.
    return
  }
  for _, arg := range args {
    if arg == nil {
      continue
    }
    stripped := stripParens(arg)
    if stripped == nil {
      continue
    }
    argType := ctx.Checker.GetTypeAtLocation(stripped)
    if !typeIsUnsafeAny(argType) {
      continue
    }
    ctx.Report(arg, noUnsafeArgumentMessage)
  }
}

const noUnsafeArgumentMessage = "Unsafe passing of a value typed as `any` into a typed parameter. Narrow the value before forwarding it."

func init() {
  Register(noUnsafeArgument{})
}
