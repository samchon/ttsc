// TypeScript-aware analog of typescript/only-throw-error for Promise
// rejection sites: `Promise.reject(value)` should hand callers an Error
// instance, not a primitive or other non-Error value. A non-Error
// rejection loses the structured stack trace and breaks downstream
// `instanceof Error` checks in `.catch(...)` / `try { await … } catch
// (err)` handlers. typescript-eslint:
// https://typescript-eslint.io/rules/prefer-promise-reject-errors/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// preferPromiseRejectErrors reports `Promise.reject(arg)`, `p.reject(arg)`
// on a Promise-typed receiver, and `reject(arg)` calls to the second
// parameter of a `new Promise((_, reject) => …)` executor when `arg`'s
// static type is a primitive (string / number / boolean / bigint / void
// / undefined / null). Mirrors `onlyThrowError` for `throw` statements.
//
// Type-aware. `any` / `unknown` / `never` pass through — they propagate
// from generic helpers and a strict rejection would explode at every
// re-reject of a caught `unknown`. Object types (including plain object
// literals) are conservatively allowed by this baseline; the practical
// effect is that `Promise.reject("boom")` and `Promise.reject(42)` are
// caught but `Promise.reject({ code: 1 })` slips through.
type preferPromiseRejectErrors struct{}

func (preferPromiseRejectErrors) Name() string {
	return "typescript/prefer-promise-reject-errors"
}
func (preferPromiseRejectErrors) NeedsTypeChecker() bool {
	return true
}
func (preferPromiseRejectErrors) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (preferPromiseRejectErrors) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil {
		return
	}
	if !preferPromiseRejectErrorsIsRejectCall(ctx, call, node) {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
		return
	}
	arg := stripParens(call.Arguments.Nodes[0])
	if arg == nil {
		return
	}
	t := ctx.Checker.GetTypeAtLocation(arg)
	if t == nil {
		return
	}
	if preferPromiseRejectErrorsIsNonError(ctx.Checker, t) {
		ctx.Report(node, "Reject promises with an Error object instead of a non-Error value.")
	}
}

// preferPromiseRejectErrorsIsRejectCall returns true when `call` is one of
//   - `Promise.reject(arg)`
//   - `<promise-typed-receiver>.reject(arg)`
//   - a bare `reject(arg)` call to the second parameter name of an
//     enclosing `new Promise((_, reject) => …)` executor.
//
// `node` is the AST node form of `call`, used for the parent walk.
func preferPromiseRejectErrorsIsRejectCall(ctx *Context, call *shimast.CallExpression, node *shimast.Node) bool {
	receiver, method, ok := promisePropertyAccessParts(call.Expression)
	if ok && method == "reject" {
		if identifierText(receiver) == "Promise" {
			return true
		}
		if ctx.Checker != nil && receiver != nil {
			if t := ctx.Checker.GetTypeAtLocation(receiver); t != nil &&
				isPromiseTypedExpression(ctx.Checker, t) {
				return true
			}
		}
		return false
	}
	// Bare identifier call — check Promise executor binding.
	name := callCalleeName(call)
	if name == "" {
		return false
	}
	return preferPromiseRejectErrorsIsExecutorReject(node, name)
}

// preferPromiseRejectErrorsIsExecutorReject walks parent function-like
// scopes from `node` and reports true when one of those scopes is the
// executor parameter of `new Promise(...)` and the executor's second
// parameter is named `name`. Mirrors the param walking used by
// `promiseNoMultipleResolved`.
func preferPromiseRejectErrorsIsExecutorReject(node *shimast.Node, name string) bool {
	for fn := nearestFunctionLike(node); fn != nil; fn = nearestFunctionLike(fn) {
		if !preferPromiseRejectErrorsIsPromiseExecutorFn(fn) {
			continue
		}
		params := fn.Parameters()
		if len(params) < 2 {
			continue
		}
		if parameterIdentifierName(params[1]) == name {
			return true
		}
	}
	return false
}

// preferPromiseRejectErrorsIsPromiseExecutorFn reports whether `fn` is
// the first argument of an enclosing `new Promise(...)` expression. The
// walk strips parentheses the same way `isPromiseCallbackFunctionFor`
// does in rules_promise.go so `new Promise(((_, reject) => …))` still
// matches.
func preferPromiseRejectErrorsIsPromiseExecutorFn(fn *shimast.Node) bool {
	if fn == nil || !isFunctionLikeKind(fn) {
		return false
	}
	cur := fn
	for parent := cur.Parent; parent != nil && parent.Kind == shimast.KindParenthesizedExpression; parent = parent.Parent {
		cur = parent
	}
	newExpr := cur.Parent
	if newExpr == nil || newExpr.Kind != shimast.KindNewExpression {
		return false
	}
	ne := newExpr.AsNewExpression()
	if ne == nil || identifierText(ne.Expression) != "Promise" || ne.Arguments == nil || len(ne.Arguments.Nodes) == 0 {
		return false
	}
	return stripParens(ne.Arguments.Nodes[0]) == fn
}

// preferPromiseRejectErrorsIsNonError mirrors `onlyThrowErrorIsPrimitive`
// in rules_ts_async.go. `any` / `unknown` / `never` are intentionally
// NOT flagged because they propagate from generic helpers; an Error
// instance fed through such a helper would otherwise produce noise.
// Union and intersection types recurse: a constituent that is primitive
// is enough to fire, matching the throw-side baseline.
func preferPromiseRejectErrorsIsNonError(checker *shimchecker.Checker, t *shimchecker.Type) bool {
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
			if preferPromiseRejectErrorsIsNonError(checker, part) {
				return true
			}
		}
		return false
	}
	const primitiveMask = shimchecker.TypeFlagsStringLike |
		shimchecker.TypeFlagsNumberLike |
		shimchecker.TypeFlagsBigIntLike |
		shimchecker.TypeFlagsBooleanLike |
		shimchecker.TypeFlagsVoid |
		shimchecker.TypeFlagsUndefined |
		shimchecker.TypeFlagsNull
	return flags&primitiveMask != 0
}

func init() {
	Register(preferPromiseRejectErrors{})
}
