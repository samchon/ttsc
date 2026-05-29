// typescript/prefer-reduce-type-parameter: when `arr.reduce(cb, init)`
// is called with an `as`-asserted initial value, fix the accumulator
// type at the call site via `arr.reduce<T>(cb, init)` instead. The
// type-parameter form binds the accumulator before the callback infers
// its parameter types from the seed, so the callback sees the intended
// type instead of the seed's widened literal shape. typescript-eslint:
// https://typescript-eslint.io/rules/prefer-reduce-type-parameter/
//
// Type-aware. Without a Checker the rule cannot prove the receiver of
// `.reduce` is an array or tuple — user types named `reduce` are
// common (`Map#reduce`, custom accumulators, etc.) and assertion-on-
// initial-value is occasionally idiomatic there. The receiver must be
// a provable array or tuple; generics, `any`, `unknown`, and `never`
// pass through to keep generic helpers quiet.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type preferReduceTypeParameter struct{}

func (preferReduceTypeParameter) Name() string {
  return "typescript/prefer-reduce-type-parameter"
}
func (preferReduceTypeParameter) NeedsTypeChecker() bool {
  return true
}
func (preferReduceTypeParameter) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (preferReduceTypeParameter) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  // `arr.reduce<T>(...)` already pins the accumulator at the call
  // site — the rule has nothing left to suggest.
  if call.TypeArguments != nil && len(call.TypeArguments.Nodes) > 0 {
    return
  }
  // The call must be `<receiver>.reduce(callback, initial)` — the
  // two-argument form whose seed is the accumulator. The single-
  // argument `arr.reduce(cb)` shape has no seed to assert against.
  if call.Arguments == nil || len(call.Arguments.Nodes) != 2 {
    return
  }
  receiver, method, ok := promisePropertyAccessParts(call.Expression)
  if !ok || method != "reduce" {
    return
  }
  initial := stripParens(call.Arguments.Nodes[1])
  if initial == nil {
    return
  }
  // The initial value must carry an explicit type assertion that the
  // rule can hoist into the call's type parameter list. Both the
  // canonical `init as T` form and the legacy `<T>init` form qualify.
  if initial.Kind != shimast.KindAsExpression && initial.Kind != shimast.KindTypeAssertionExpression {
    return
  }
  if receiver == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(receiver)
  if t == nil {
    return
  }
  if !preferReduceIsArrayOrTuple(ctx.Checker, t) {
    return
  }
  ctx.Report(initial, preferReduceMessage)
}

const preferReduceMessage = "Pass the accumulator type to `reduce` as a type parameter — `arr.reduce<T>(cb, init)` — instead of asserting on the initial value."

// preferReduceIsArrayOrTuple reports whether t is provably an array or
// tuple. Mirrors `preferIncludesIsArrayOrString` but excludes strings
// (which have no `.reduce`). Generics, `any`, `unknown`, and `never`
// intentionally fail closed so the rule does not blow up on generic
// helpers whose receiver type leaks downward.
func preferReduceIsArrayOrTuple(checker *shimchecker.Checker, t *shimchecker.Type) bool {
  if checker == nil || t == nil {
    return false
  }
  flags := t.Flags()
  if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
    return false
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if !preferReduceIsArrayOrTuple(checker, part) {
        return false
      }
    }
    return true
  }
  if shimchecker.Checker_isArrayType(checker, t) {
    return true
  }
  if shimchecker.IsTupleType(t) {
    return true
  }
  return false
}

func init() {
  Register(preferReduceTypeParameter{})
}
