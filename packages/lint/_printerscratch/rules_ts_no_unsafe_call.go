// typescript/no-unsafe-call: invoking a value whose static type is
// `any` discards every signature check the type system would otherwise
// perform. The runtime call still happens, but the parameter list is
// unchecked, the return type is `any`, and any downstream use of the
// result silently spreads the `any` further. typescript-eslint:
// https://typescript-eslint.io/rules/no-unsafe-call/
//
// Type-aware. The rule visits the three syntactic invocation shapes —
// `f(...)`, `new F(...)`, and the tagged-template form `f` + “"x"“ —
// and reports when the callee resolves to a type whose flags include
// `TypeFlagsAny`. `unknown` is intentionally not flagged: it requires a
// narrowing assertion before the call, which is the explicit ergonomics
// the upstream rule pushes toward. `never` is also skipped — a never
// callee means the code is unreachable, which is a different rule's
// concern.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noUnsafeCall struct{}

func (noUnsafeCall) Name() string { return "typescript/no-unsafe-call" }
func (noUnsafeCall) NeedsTypeChecker() bool {
  return true
}
func (noUnsafeCall) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindCallExpression,
    shimast.KindNewExpression,
    shimast.KindTaggedTemplateExpression,
  }
}
func (noUnsafeCall) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  var callee *shimast.Node
  switch node.Kind {
  case shimast.KindCallExpression:
    if call := node.AsCallExpression(); call != nil {
      callee = call.Expression
    }
  case shimast.KindNewExpression:
    if ne := node.AsNewExpression(); ne != nil {
      callee = ne.Expression
    }
  case shimast.KindTaggedTemplateExpression:
    if tag := node.AsTaggedTemplateExpression(); tag != nil {
      callee = tag.Tag
    }
  }
  if callee == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(callee)
  if !typeIsUnsafeAny(t) {
    return
  }
  ctx.Report(callee, noUnsafeCallMessage)
}

const noUnsafeCallMessage = "Unsafe call of a value typed as `any`. Narrow the callee to a concrete signature before invoking it."

// typeIsUnsafeAny reports whether `t` carries the `any` flag — the only
// shape these unsafe-* rules flag. `unknown` is intentionally NOT
// included: it forces a narrowing assertion at the use site, which is
// the safer ergonomic the upstream rules push toward. Returns false on
// nil so an absent type silently bypasses the rule rather than firing
// on every unanalysable expression.
func typeIsUnsafeAny(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  return t.Flags()&shimchecker.TypeFlagsAny != 0
}

func init() {
  Register(noUnsafeCall{})
}
