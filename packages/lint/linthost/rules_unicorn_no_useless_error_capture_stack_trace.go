// unicorn/no-useless-error-capture-stack-trace: `new Error()` already
// captures a stack trace by default, so calling
// `Error.captureStackTrace(this, …)` inside an Error-subclass
// constructor just rebuilds the same trace and adds noise without
// changing behavior. The rule flags the redundant call.
//
// AST-only MVP: visit each `CallExpression`, match when the callee is
// `Error.captureStackTrace` and the first argument is the `this`
// keyword. Detecting "inside an Error subclass constructor" is left to
// a future iteration — the MVP covers the common shape directly and is
// safe because `Error.captureStackTrace(this, …)` is uniformly useless
// inside subclasses anyway.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-error-capture-stack-trace.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessErrorCaptureStackTrace struct{}

func (unicornNoUselessErrorCaptureStackTrace) Name() string {
	return "unicorn/no-useless-error-capture-stack-trace"
}
func (unicornNoUselessErrorCaptureStackTrace) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoUselessErrorCaptureStackTrace) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil {
		return
	}
	if !isMatchingPropertyAccess(call.Expression, "Error", "captureStackTrace") {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) < 1 {
		return
	}
	first := stripParens(call.Arguments.Nodes[0])
	if first == nil || first.Kind != shimast.KindThisKeyword {
		return
	}
	ctx.Report(node, "Don't call `Error.captureStackTrace(this, ...)` in an `Error` subclass — the default capture already happens.")
}

func init() {
	Register(unicornNoUselessErrorCaptureStackTrace{})
}
