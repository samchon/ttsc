// unicorn/error-message: a `new Error()` (or any built-in Error subclass)
// without a message string strips the most valuable diagnostic from the
// stack trace. The error type alone tells readers nothing about WHY the
// throw site fired; the rule requires every Error construction to carry
// a non-empty message.
//
// AST-only: visit each `NewExpression`, match the callee identifier
// against the built-in Error allowlist, then inspect the argument list.
// Zero arguments fires immediately; a single argument fires only when it
// is a string literal whose text is empty (`new Error("")`). Calls with
// dynamic arguments are out of scope because the rule cannot prove the
// argument resolves to a non-empty string at runtime.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/error-message.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornErrorMessageBuiltinNames = map[string]struct{}{
	"Error":          {},
	"TypeError":      {},
	"RangeError":     {},
	"SyntaxError":    {},
	"ReferenceError": {},
	"EvalError":      {},
	"URIError":       {},
	"AggregateError": {},
}

type unicornErrorMessage struct{}

func (unicornErrorMessage) Name() string { return "unicorn/error-message" }
func (unicornErrorMessage) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindNewExpression}
}
func (unicornErrorMessage) Check(ctx *Context, node *shimast.Node) {
	ne := node.AsNewExpression()
	if ne == nil {
		return
	}
	name := identifierText(ne.Expression)
	if name == "" {
		return
	}
	if _, ok := unicornErrorMessageBuiltinNames[name]; !ok {
		return
	}
	// Zero arguments — `new Error()` / `new Error` — always fires.
	if ne.Arguments == nil || len(ne.Arguments.Nodes) == 0 {
		ctx.Report(node, "Pass an error message to the `Error` constructor.")
		return
	}
	// Single argument — fire only when the argument is an empty string
	// literal. Dynamic arguments cannot be proven empty statically.
	if len(ne.Arguments.Nodes) == 1 {
		arg := stripParens(ne.Arguments.Nodes[0])
		if arg != nil && arg.Kind == shimast.KindStringLiteral && stringLiteralText(arg) == "" {
			ctx.Report(node, "Pass an error message to the `Error` constructor.")
		}
	}
}

func init() {
	Register(unicornErrorMessage{})
}
