// unicorn/prefer-import-meta-properties: the legacy
// `fileURLToPath(import.meta.url)` pattern was the only way to obtain
// the on-disk path of the current ES module before Node added the
// dedicated `import.meta.dirname` and `import.meta.filename`
// properties. Once those exist, the workaround is pure noise — it
// imports `url` for one call and adds a layer the reader has to
// translate back to "the current file's directory / filename".
//
// AST-only: visit `CallExpression`, match a bare `fileURLToPath`
// callee, and check that the sole argument is the property access
// `import.meta.url`. The canonical legacy shape is the only case
// covered — other call sites of `fileURLToPath` are out of scope.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-import-meta-properties.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferImportMetaProperties struct{}

func (unicornPreferImportMetaProperties) Name() string {
	return "unicorn/prefer-import-meta-properties"
}
func (unicornPreferImportMetaProperties) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferImportMetaProperties) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil {
		return
	}
	if identifierText(call.Expression) != "fileURLToPath" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
		return
	}
	arg := stripParens(call.Arguments.Nodes[0])
	if arg == nil || arg.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := arg.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) != "url" {
		return
	}
	receiver := stripParens(access.Expression)
	if receiver == nil {
		return
	}
	// `import.meta` parses as either a MetaProperty token or a
	// PropertyAccess(import, meta) chain depending on the path; both
	// resolve textually to the same source span.
	if receiver.Kind == shimast.KindMetaProperty {
		ctx.Report(node, "Prefer `import.meta.dirname` / `import.meta.filename` over `fileURLToPath(import.meta.url)`.")
		return
	}
	if isMatchingPropertyAccess(receiver, "import", "meta") {
		ctx.Report(node, "Prefer `import.meta.dirname` / `import.meta.filename` over `fileURLToPath(import.meta.url)`.")
	}
}

func init() {
	Register(unicornPreferImportMetaProperties{})
}
