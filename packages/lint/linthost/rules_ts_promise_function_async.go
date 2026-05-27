// promiseFunctionAsync requires a function whose return type is
// `Promise<T>` (or a Promise-like thenable) to be declared with the
// `async` keyword. typescript-eslint:
// https://typescript-eslint.io/rules/promise-function-async/
//
// Type-aware. An `async` function wraps a synchronous `throw` into a
// rejected Promise so the caller's `await` / `.catch(...)` observes
// it; the non-async equivalent throws synchronously and bypasses every
// Promise-aware handler downstream. Marking the function `async` keeps
// the rejection channel consistent with the declared return type.
//
// Skipped:
//   - functions already declared `async` (the contract holds);
//   - abstract methods and overload signatures (no body to wrap — the
//     `async` keyword can only be applied to the implementation);
//   - functions whose declared / inferred return type is not a
//     Promise (`any` / `unknown` / `never` pass through, matching the
//     conservative `isPromiseTypedExpression` baseline used by the
//     surrounding async family).
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type promiseFunctionAsync struct{}

func (promiseFunctionAsync) Name() string { return "typescript/promise-function-async" }
func (promiseFunctionAsync) NeedsTypeChecker() bool {
	return true
}
func (promiseFunctionAsync) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindFunctionDeclaration,
		shimast.KindFunctionExpression,
		shimast.KindArrowFunction,
		shimast.KindMethodDeclaration,
	}
}
func (promiseFunctionAsync) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	if hasAsyncModifier(node) {
		return
	}
	// Skip overload signatures and abstract methods — only the
	// implementation signature carries an executable body that the
	// `async` keyword could wrap.
	if node.Body() == nil {
		return
	}
	if hasModifier(node, shimast.KindAbstractKeyword) {
		return
	}
	sig := ctx.Checker.GetSignatureFromDeclaration(node)
	if sig == nil {
		return
	}
	returnType := ctx.Checker.GetReturnTypeOfSignature(sig)
	if returnType == nil {
		return
	}
	if !isPromiseTypedExpression(ctx.Checker, returnType) {
		return
	}
	startPos := keywordStart(ctx.File, node, "function")
	if startPos >= 0 {
		ctx.ReportRange(startPos, startPos+len("function"), "Function returning a Promise should be declared `async` so synchronous throws surface as a rejected Promise.")
		return
	}
	ctx.Report(node, "Function returning a Promise should be declared `async` so synchronous throws surface as a rejected Promise.")
}

func init() {
	Register(promiseFunctionAsync{})
}
