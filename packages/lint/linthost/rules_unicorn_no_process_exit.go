// unicorn/no-process-exit: calling `process.exit(...)` short-circuits the
// Node runtime before pending I/O, timers, or microtasks drain, which
// turns ordinary error paths into silent data loss. The rule pushes
// authors toward throwing or returning a non-zero status so the host
// process owns the termination decision.
//
// AST-only first pass: a `CallExpression` whose callee is a
// `PropertyAccessExpression` of the literal form `process.exit` fires.
// Computed access (`process["exit"]`), optional chaining
// (`process?.exit()`), and shadowed `process` bindings are intentionally
// out of scope — only the bare callsite is reported.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-process-exit.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoProcessExit struct{}

func (unicornNoProcessExit) Name() string { return "unicorn/no-process-exit" }
func (unicornNoProcessExit) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornNoProcessExit) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Expression) != "process" {
		return
	}
	if identifierText(access.Name()) != "exit" {
		return
	}
	ctx.Report(node, "Don't use `process.exit()`. Throw an error or return a non-zero status instead.")
}

func init() {
	Register(unicornNoProcessExit{})
}
