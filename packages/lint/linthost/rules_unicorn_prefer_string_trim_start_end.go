// unicorn/prefer-string-trim-start-end: `String#trimLeft` and
// `String#trimRight` are the deprecated names for what
// `String#trimStart` / `String#trimEnd` express directly. The deprecated
// names are still callable but should be replaced for consistency with
// the modern naming. The rule fires on zero-argument calls to either
// deprecated method.
//
// AST-only: a `CallExpression` whose callee is `.trimLeft` or
// `.trimRight` and whose argument list is empty matches. Arguments are
// theoretically not allowed on either method, but the AST does not
// know that — the rule defends against the syntactic shape only.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-trim-start-end.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferStringTrimStartEnd struct{}

func (unicornPreferStringTrimStartEnd) Name() string {
	return "unicorn/prefer-string-trim-start-end"
}
func (unicornPreferStringTrimStartEnd) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferStringTrimStartEnd) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	switch identifierText(access.Name()) {
	case "trimLeft", "trimRight":
	default:
		return
	}
	if call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
		return
	}
	ctx.Report(node, "Prefer `String#trimStart` / `String#trimEnd` over the deprecated `trimLeft` / `trimRight`.")
}

func init() {
	Register(unicornPreferStringTrimStartEnd{})
}
