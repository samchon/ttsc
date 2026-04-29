package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-debugger: forbid `debugger` statements.
// https://eslint.org/docs/latest/rules/no-debugger
type noDebugger struct{}

func (noDebugger) Name() string           { return "no-debugger" }
func (noDebugger) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindDebuggerStatement} }
func (noDebugger) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Unexpected `debugger` statement.")
}

// no-with: forbid `with` statements (already disallowed in strict mode,
// but lint catches it before the parse error).
// https://eslint.org/docs/latest/rules/no-with
type noWith struct{}

func (noWith) Name() string           { return "no-with" }
func (noWith) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindWithStatement} }
func (noWith) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Unexpected `with` statement.")
}

func init() {
	Register(noDebugger{})
	Register(noWith{})
}
