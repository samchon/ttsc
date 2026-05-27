// unicorn/relative-url-style: `new URL("./foo", base)` and
// `new URL("foo", base)` resolve identically, so the leading `./` is
// noise. The rule normalizes on the "never leading `./`" style and
// fires whenever a `new URL(…)` literal first argument starts with
// `./`.
//
// AST-only: visit `KindNewExpression`, accept when the callee is the
// bare `URL` identifier, and inspect the first argument — when it's a
// string-shaped literal whose text starts with `./`, report the
// argument node. Absolute URLs (`http://…`), schemeless protocol
// references, and paths starting with `/` or `../` are untouched; only
// the explicit `./` prefix is the redundant case the rule targets.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/relative-url-style.md
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornRelativeURLStyle struct{}

func (unicornRelativeURLStyle) Name() string { return "unicorn/relative-url-style" }
func (unicornRelativeURLStyle) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindNewExpression}
}
func (unicornRelativeURLStyle) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsNewExpression()
	if expr == nil || identifierText(expr.Expression) != "URL" {
		return
	}
	if expr.Arguments == nil || len(expr.Arguments.Nodes) == 0 {
		return
	}
	arg := expr.Arguments.Nodes[0]
	text := stringLiteralText(arg)
	if text == "" {
		return
	}
	if strings.HasPrefix(text, "./") {
		ctx.Report(arg, "Drop the leading `./` from relative URLs passed to `new URL`.")
	}
}

func init() {
	Register(unicornRelativeURLStyle{})
}
