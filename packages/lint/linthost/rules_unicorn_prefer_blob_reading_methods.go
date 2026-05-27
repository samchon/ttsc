// unicorn/prefer-blob-reading-methods: `FileReader#readAsArrayBuffer`
// and `FileReader#readAsText` predate the promise-returning `Blob`
// methods. They require attaching `load` / `error` listeners and reading
// `reader.result` in a callback, while `Blob#arrayBuffer()` and
// `Blob#text()` return a Promise that resolves to the same value
// directly. The newer shape is shorter, easier to reason about, and the
// rule discourages the legacy callback form.
//
// AST-only: visit each `CallExpression`, match a property-access callee
// whose method identifier is `readAsArrayBuffer` or `readAsText`, and
// fire on the call. The receiver is not type-checked — the syntactic
// shape is the signal regardless of whether the value is statically a
// `FileReader`.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-blob-reading-methods.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferBlobReadingMethods struct{}

func (unicornPreferBlobReadingMethods) Name() string {
	return "unicorn/prefer-blob-reading-methods"
}
func (unicornPreferBlobReadingMethods) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferBlobReadingMethods) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	switch identifierText(access.Name()) {
	case "readAsArrayBuffer", "readAsText":
		ctx.Report(node, "Prefer `Blob#arrayBuffer()` / `Blob#text()` over `FileReader#readAsArrayBuffer` / `readAsText`.")
	}
}

func init() {
	Register(unicornPreferBlobReadingMethods{})
}
