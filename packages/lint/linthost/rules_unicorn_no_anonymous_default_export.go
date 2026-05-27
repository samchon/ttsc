// unicorn/no-anonymous-default-export: `export default function () {}`
// and `export default class {}` (and the arrow-function equivalent)
// leave the exported value without a local binding name. Stack traces,
// dev-tools labels, and downstream `import X from …` all rebind to the
// importer's chosen name, so the export site contributes nothing to
// readability. Giving the function/class a name keeps the original
// identifier visible everywhere.
//
// AST-only: TypeScript-Go's parser splits the two surface forms of
// `export default`. `export default <expression>` parses as
// `KindExportAssignment`; `export default function …` / `export default
// class …` parse as `KindFunctionDeclaration` / `KindClassDeclaration`
// with `export` + `default` modifiers and an optional `Name()`. The
// rule covers both paths: it reports an `ExportAssignment` whose
// expression is a `KindFunctionExpression`/`KindArrowFunction`/
// `KindClassExpression` with no name, and reports an export-default
// `Function`/`ClassDeclaration` whose `Name()` is nil.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-anonymous-default-export.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoAnonymousDefaultExport struct{}

func (unicornNoAnonymousDefaultExport) Name() string {
	return "unicorn/no-anonymous-default-export"
}
func (unicornNoAnonymousDefaultExport) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindExportAssignment,
		shimast.KindFunctionDeclaration,
		shimast.KindClassDeclaration,
	}
}
func (unicornNoAnonymousDefaultExport) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindExportAssignment:
		assign := node.AsExportAssignment()
		if assign == nil || assign.IsExportEquals || assign.Expression == nil {
			return
		}
		expr := stripParens(assign.Expression)
		if expr == nil {
			return
		}
		switch expr.Kind {
		case shimast.KindFunctionExpression:
			if fn := expr.AsFunctionExpression(); fn != nil && fn.Name() == nil {
				ctx.Report(node, "Give a name to the default export.")
			}
		case shimast.KindArrowFunction:
			// Arrow functions never bind a name; an `export default` of
			// one is always anonymous.
			ctx.Report(node, "Give a name to the default export.")
		case shimast.KindClassExpression:
			if cls := expr.AsClassExpression(); cls != nil && cls.Name() == nil {
				ctx.Report(node, "Give a name to the default export.")
			}
		}
	case shimast.KindFunctionDeclaration, shimast.KindClassDeclaration:
		if !hasModifier(node, shimast.KindExportKeyword) ||
			!hasModifier(node, shimast.KindDefaultKeyword) {
			return
		}
		if node.Name() == nil {
			ctx.Report(node, "Give a name to the default export.")
		}
	}
}

func init() {
	Register(unicornNoAnonymousDefaultExport{})
}
