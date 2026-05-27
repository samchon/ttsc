// unicorn/no-console-spaces: `console.log("a ", "b")` produces
// `"a  b"` with a doubled space because the runtime already inserts a
// single ASCII space between arguments. Leading/trailing whitespace on
// the literal duplicates that separator and is almost always a leftover
// from hand-formatting. The rule flags every string-literal argument
// whose content starts or ends with a space so the source converges on
// argument-only content and the runtime owns the separator.
//
// AST-only and identifier-text-driven: dispatch on `CallExpression`,
// match a `console.<method>` callee against the six common log
// methods, and report each `StringLiteral` argument with a leading or
// trailing space. The receiver is matched by identifier text only;
// shadowed `console` bindings are out of scope, mirroring the other
// console-shape rules in this family.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-console-spaces.md
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornNoConsoleSpaces struct{}

func (unicornNoConsoleSpaces) Name() string { return "unicorn/no-console-spaces" }
func (unicornNoConsoleSpaces) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoConsoleSpaces) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Expression) != "console" {
		return
	}
	switch identifierText(access.Name()) {
	case "log", "warn", "error", "info", "debug", "trace":
	default:
		return
	}
	if call.Arguments == nil {
		return
	}
	for _, arg := range call.Arguments.Nodes {
		if arg == nil || arg.Kind != shimast.KindStringLiteral {
			continue
		}
		text := stringLiteralText(arg)
		if strings.HasPrefix(text, " ") || strings.HasSuffix(text, " ") {
			ctx.Report(arg, "Don't include leading or trailing spaces in `console.<method>` arguments.")
		}
	}
}

func init() {
	Register(unicornNoConsoleSpaces{})
}
