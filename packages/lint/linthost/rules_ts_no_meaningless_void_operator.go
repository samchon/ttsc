// typescript/no-meaningless-void-operator reports `void X` where the
// operand `X` is already statically typed `void`. The `void` operator
// always evaluates to `undefined`; if the operand was going to produce
// `undefined` anyway, the operator adds nothing and obscures the
// intent. The most common shape is `void someVoidReturningCall()`
// somewhere a `void` discard would be useful for a non-void operand
// (e.g. fire-and-forget Promise) — but a `void`-typed operand is
// already discarded.
// https://typescript-eslint.io/rules/no-meaningless-void-operator/
//
// Type-aware. Without a Checker the rule cannot tell `void` from any
// other type, so Context.Checker == nil short-circuits the Check to a
// no-op the way the other type-aware rules do. The upstream
// `checkNever` option is left at its default of `false`: only the
// `void` operand triggers, `never` does not.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noMeaninglessVoidOperator struct{}

func (noMeaninglessVoidOperator) Name() string {
  return "typescript/no-meaningless-void-operator"
}
func (noMeaninglessVoidOperator) NeedsTypeChecker() bool { return true }
func (noMeaninglessVoidOperator) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVoidExpression}
}
func (noMeaninglessVoidOperator) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  expr := node.AsVoidExpression()
  if expr == nil || expr.Expression == nil {
    return
  }
  operand := stripParens(expr.Expression)
  if operand == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(operand)
  if t == nil {
    return
  }
  if !isVoidOnlyType(t) {
    return
  }
  ctx.Report(node, "The `void` operator on a value already typed `void` adds nothing — drop the operator.")
}

// isVoidOnlyType reports whether t is the bare `void` type or a union
// composed entirely of `void` constituents. The upstream rule fires
// only when the operand carries no non-void member; a mixed `void |
// number` operand still needs the operator to discard the runtime
// value, so it is left alone.
func isVoidOnlyType(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  flags := t.Flags()
  if flags&shimchecker.TypeFlagsVoid != 0 {
    return true
  }
  if flags&shimchecker.TypeFlagsUnion != 0 {
    parts := t.Types()
    if len(parts) == 0 {
      return false
    }
    for _, part := range parts {
      if !isVoidOnlyType(part) {
        return false
      }
    }
    return true
  }
  return false
}

func init() {
  Register(noMeaninglessVoidOperator{})
}
