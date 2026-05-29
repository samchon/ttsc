// typescript/no-unsafe-unary-minus: the unary `-` operator coerces its
// operand via `Number()` at runtime, so strings, booleans, and plain
// objects silently produce `NaN`, `0`, `-1`, or `-NaN` instead of a
// negated number. The rule restricts the operator to operands whose
// static type is number-like or bigint-like — the two shapes where the
// negation is a real arithmetic operation rather than a hidden
// coercion. typescript-eslint:
// https://typescript-eslint.io/rules/no-unsafe-unary-minus/
//
// Type-aware. Without a Checker the rule cannot tell `-x` on a number
// apart from `-x` on a string, so Context.Checker == nil short-circuits
// the visit the same way every other type-aware rule in this package
// does. `any` / `unknown` / `never` pass through to match the upstream
// `allowAny`-style defaults that keep generic helpers quiet.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noUnsafeUnaryMinus struct{}

func (noUnsafeUnaryMinus) Name() string { return "typescript/no-unsafe-unary-minus" }
func (noUnsafeUnaryMinus) NeedsTypeChecker() bool {
  return true
}
func (noUnsafeUnaryMinus) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPrefixUnaryExpression}
}
func (noUnsafeUnaryMinus) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  expr := node.AsPrefixUnaryExpression()
  if expr == nil || expr.Operator != shimast.KindMinusToken || expr.Operand == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(expr.Operand)
  if t == nil {
    return
  }
  if noUnsafeUnaryMinusIsNumeric(t) {
    return
  }
  ctx.Report(node, "Unary `-` requires a number-like or bigint-like operand. Other shapes are silently coerced via `Number(x)` and almost always indicate a bug.")
}

// noUnsafeUnaryMinusIsNumeric reports whether t is provably number-like
// or bigint-like. `any` / `unknown` / `never` are treated as numeric to
// keep the rule silent on generic helpers and untyped boundaries —
// matching the upstream `allowAny` posture. Unions and intersections
// must have every constituent numeric for the whole type to count.
func noUnsafeUnaryMinusIsNumeric(t *shimchecker.Type) bool {
  if t == nil {
    return true
  }
  flags := t.Flags()
  if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
    return true
  }
  if flags&(shimchecker.TypeFlagsNumberLike|shimchecker.TypeFlagsBigIntLike) != 0 {
    return true
  }
  if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
    for _, part := range t.Types() {
      if part == nil {
        continue
      }
      if !noUnsafeUnaryMinusIsNumeric(part) {
        return false
      }
    }
    return true
  }
  return false
}

func init() {
  Register(noUnsafeUnaryMinus{})
}
