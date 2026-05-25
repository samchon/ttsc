package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noDebugger: forbid `debugger` statements.
// https://eslint.org/docs/latest/rules/no-debugger
type noDebugger struct{}

func (noDebugger) Name() string           { return "no-debugger" }
func (noDebugger) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindDebuggerStatement} }
func (noDebugger) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Unexpected `debugger` statement.")
}

// noWith: forbid `with` statements. `with` is disallowed in strict mode
// at the parser level, but TypeScript source files may not use strict mode
// explicitly; the lint rule catches it uniformly regardless of mode.
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
