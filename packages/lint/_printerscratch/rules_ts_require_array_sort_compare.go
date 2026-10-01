// typescript/require-array-sort-compare: require an explicit comparator
// for `arr.sort()` and `arr.toSorted()`. Without a comparator, both
// methods coerce elements to strings before ordering them, so
// `[10, 2, 1].sort()` evaluates to `[1, 10, 2]` — almost never what the
// caller meant. The fix is to pass `(a, b) => a - b`-style comparator.
// typescript-eslint:
// https://typescript-eslint.io/rules/require-array-sort-compare/
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// requireArraySortCompare reports `<arr>.sort()` and `<arr>.toSorted()`
// when no comparator argument is supplied. Type-aware: the Checker
// confirms the receiver is an array (or tuple) so user-defined methods
// named `sort` / `toSorted` on non-array types do not trip the rule.
type requireArraySortCompare struct{}

func (requireArraySortCompare) Name() string {
  return "typescript/require-array-sort-compare"
}
func (requireArraySortCompare) NeedsTypeChecker() bool {
  return true
}
func (requireArraySortCompare) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (requireArraySortCompare) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  // Only fire when the callee is a property access ending in `.sort`
  // or `.toSorted` and the call passes zero arguments.
  receiver, method, ok := promisePropertyAccessParts(call.Expression)
  if !ok || (method != "sort" && method != "toSorted") {
    return
  }
  if call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
    return
  }
  if receiver == nil {
    return
  }
  t := ctx.Checker.GetTypeAtLocation(receiver)
  if t == nil {
    return
  }
  if !requireArraySortCompareIsArrayLike(ctx.Checker, t) {
    return
  }
  ctx.Report(node, "Require an explicit compareFunction for `."+method+"()` — without one, elements are coerced to strings before being ordered.")
}

// requireArraySortCompareIsArrayLike reports whether t is provably an
// array or a tuple. It recurses into constituents so a union like
// `number[] | string[]` still resolves to "array" via every constituent.
// `any` / `unknown` / `never` are intentionally NOT treated as array-like —
// they propagate from generic helpers and would explode the false-positive
// volume.
func requireArraySortCompareIsArrayLike(checker *shimchecker.Checker, t *shimchecker.Type) bool {
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
      if !requireArraySortCompareIsArrayLike(checker, part) {
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
  Register(requireArraySortCompare{})
}
