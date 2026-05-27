// unicorn/no-lonely-if: `else { if (cond) { … } }` collapses to
// `else if (cond) { … }`. Wrapping a single `if` in an `else` block
// adds an extra brace pair and an extra indentation level without
// changing semantics, so the rule flags it as redundant punctuation.
//
// AST-only and parent-walking: visit every `IfStatement`, then check
// whether its parent is a `Block` containing exactly this one
// statement AND that block is the `ElseStatement` of an outer
// `IfStatement`. Mirrors the core `no-lonely-if` rule shape.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-lonely-if.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoLonelyIf struct{}

func (unicornNoLonelyIf) Name() string           { return "unicorn/no-lonely-if" }
func (unicornNoLonelyIf) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindIfStatement} }
func (unicornNoLonelyIf) Check(ctx *Context, node *shimast.Node) {
	parent := node.Parent
	if parent == nil || parent.Kind != shimast.KindBlock {
		return
	}
	block := parent.AsBlock()
	if block == nil || block.Statements == nil {
		return
	}
	if len(block.Statements.Nodes) != 1 {
		return
	}
	grand := parent.Parent
	if grand == nil || grand.Kind != shimast.KindIfStatement {
		return
	}
	gif := grand.AsIfStatement()
	if gif == nil || gif.ElseStatement != parent {
		return
	}
	ctx.Report(node, "Use `else if` instead of an `if` as the only statement inside an `else` block.")
}

func init() {
	Register(unicornNoLonelyIf{})
}
