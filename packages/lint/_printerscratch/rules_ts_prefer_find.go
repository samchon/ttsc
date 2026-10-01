// typescript/prefer-find: prefer `arr.find(predicate)` over the
// `arr.filter(predicate)[0]` and `arr.filter(predicate).at(0)` shapes.
// `find` short-circuits on the first match instead of materializing the
// whole filtered array, so for sufficiently large inputs it is strictly
// faster — and at every input size it expresses the intent ("get me
// the first match") more directly than reading the head of a filtered
// list. typescript-eslint:
// https://typescript-eslint.io/rules/prefer-find/
//
// Type-aware. Without a Checker the rule cannot prove the receiver of
// `filter` is array-like, so Context.Checker == nil short-circuits each
// Check to a no-op the way `no-for-in-array` and `prefer-includes` do.
// The receiver type must be a provable array or tuple — generic, `any`,
// `unknown`, and `never` pass through so generic helpers don't explode
// with false positives on user-defined `filter` methods.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type preferFind struct{}

func (preferFind) Name() string { return "typescript/prefer-find" }
func (preferFind) NeedsTypeChecker() bool {
  return true
}
func (preferFind) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindElementAccessExpression,
    shimast.KindCallExpression,
  }
}
func (preferFind) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }
  switch node.Kind {
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    if access == nil || access.Expression == nil || access.ArgumentExpression == nil {
      return
    }
    // Index must be the literal `0`.
    if !preferFindIsZeroLiteral(access.ArgumentExpression) {
      return
    }
    if !preferFindIsArrayFilterCall(ctx, access.Expression) {
      return
    }
    ctx.Report(node, preferFindMessage)
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil || call.Expression == nil {
      return
    }
    // Match `<filter-call>.at(0)`.
    receiver, method, ok := promisePropertyAccessParts(call.Expression)
    if !ok || method != "at" {
      return
    }
    if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
      return
    }
    if !preferFindIsZeroLiteral(call.Arguments.Nodes[0]) {
      return
    }
    if !preferFindIsArrayFilterCall(ctx, receiver) {
      return
    }
    ctx.Report(node, preferFindMessage)
  }
}

const preferFindMessage = "Prefer `.find(predicate)` over `.filter(predicate)[0]` / `.filter(predicate).at(0)` — `find` short-circuits on the first match and avoids materializing the full filtered array."

// preferFindIsZeroLiteral reports whether `node` (after stripping
// parens) is the numeric literal `0` — the only index `find` can
// replace. `+0` and `0` are both accepted; `-0` is rejected because it
// is technically a separate value at the language level even though
// `arr[-0]` resolves the same. Keeps the rule's noise floor narrow.
func preferFindIsZeroLiteral(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindNumericLiteral {
    return numericLiteralText(node) == "0"
  }
  if node.Kind == shimast.KindPrefixUnaryExpression {
    prefix := node.AsPrefixUnaryExpression()
    if prefix == nil || prefix.Operand == nil {
      return false
    }
    if prefix.Operator != shimast.KindPlusToken {
      return false
    }
    return prefix.Operand.Kind == shimast.KindNumericLiteral &&
      numericLiteralText(prefix.Operand) == "0"
  }
  return false
}

// preferFindIsArrayFilterCall reports whether `node` (after stripping
// parens) is a `<receiver>.filter(predicate)` CallExpression whose
// receiver type is provably an array or tuple. Mirrors the shape used
// by `prefer-includes` for `.indexOf(x)`: a user type with a custom
// `filter` method should NOT trigger the rule.
func preferFindIsArrayFilterCall(ctx *Context, node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return false
  }
  receiver, method, ok := promisePropertyAccessParts(call.Expression)
  if !ok || method != "filter" {
    return false
  }
  if receiver == nil {
    return false
  }
  // `.filter` accepts an optional `thisArg`, so require at least one
  // argument (the predicate) — a zero-arg call would not parse on the
  // real lib.es5 declaration and is conservatively skipped.
  if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return false
  }
  t := ctx.Checker.GetTypeAtLocation(receiver)
  if t == nil {
    return false
  }
  return preferFindIsArrayLike(ctx.Checker, t)
}

// preferFindIsArrayLike reports whether t is provably an array or
// tuple. The constituent-recursion shape mirrors
// `preferIncludesIsArrayOrString`: a union like `T[] | T[]` is still
// accepted because every constituent is rewritable. `any` / `unknown` /
// `never` are intentionally NOT treated as matching — they leak from
// generic helpers and would explode the false-positive volume on
// user-defined `filter` methods. Strings are NOT included here even
// though they expose a `.filter`-shaped method via lib polyfills,
// because the upstream rule only fires on the genuine `Array#filter`.
func preferFindIsArrayLike(checker *shimchecker.Checker, t *shimchecker.Type) bool {
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
      if !preferFindIsArrayLike(checker, part) {
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
  Register(preferFind{})
}
