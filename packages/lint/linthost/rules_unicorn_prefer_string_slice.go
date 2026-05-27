// unicorn/prefer-string-slice: `String#substr` is deprecated and
// `String#substring` has surprising "swap arguments when end < start"
// semantics. `String#slice` is the single modern alternative whose
// behavior matches author intent. The rule fires on any `.substr(…)`
// or `.substring(…)` callsite so the codebase converges on `.slice`.
//
// AST-only: a `CallExpression` whose callee is a
// `PropertyAccessExpression` ending in `substr` or `substring`
// matches. Receiver typing is intentionally not checked — both names
// exist almost exclusively on strings in real code, and the
// upstream rule treats them as banned regardless.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-slice.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferStringSlice struct{}

func (unicornPreferStringSlice) Name() string { return "unicorn/prefer-string-slice" }
func (unicornPreferStringSlice) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferStringSlice) Check(ctx *Context, node *shimast.Node) {
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
	case "substr", "substring":
	default:
		return
	}
	ctx.Report(node, "Prefer `String#slice()` over `substr` / `substring`.")
}

func init() {
	Register(unicornPreferStringSlice{})
}
