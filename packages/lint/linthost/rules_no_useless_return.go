// noUselessReturn reports a bare `return;` whose only effect is to end a
// function body that would have returned anyway. `function f() { … ;
// return; }` is identical to `function f() { … ; }`: the trailing
// statement adds no behavior, only noise. The conservative baseline only
// fires at the very last statement of a block that is itself the
// immediate body of a function-like — any earlier `return;` inside a
// loop, branch, or inner block may still be load-bearing.
// https://eslint.org/docs/latest/rules/no-useless-return
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noUselessReturn struct{}

func (noUselessReturn) Name() string { return "no-useless-return" }
func (noUselessReturn) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindReturnStatement}
}
func (noUselessReturn) Check(ctx *Context, node *shimast.Node) {
	ret := node.AsReturnStatement()
	if ret == nil || ret.Expression != nil {
		// `return X;` is never useless: it carries a value.
		return
	}
	parent := node.Parent
	if parent == nil || parent.Kind != shimast.KindBlock {
		return
	}
	block := parent.AsBlock()
	if block == nil || block.Statements == nil {
		return
	}
	stmts := block.Statements.Nodes
	if len(stmts) == 0 || stmts[len(stmts)-1] != node {
		// Only the last statement of the block is provably useless;
		// any earlier `return;` may guard the statements that follow.
		return
	}
	if !isFunctionLikeKind(parent.Parent) {
		// The block must be the immediate body of a function-like so
		// the function's natural completion is what would run next.
		return
	}
	ctx.Report(node, "Unnecessary return statement.")
}

func init() {
	Register(noUselessReturn{})
}
