// unicorn/prefer-set-size: `[...set].length` materializes the entire Set
// into a throwaway array just to read its element count. `Set#size` is a
// constant-time property that returns the same value without the
// allocation, and reads more naturally for the intent the code expresses.
//
// AST-only: visit each `PropertyAccessExpression`, match when the
// accessed property is named `length` AND the receiver is an
// array-literal expression whose only element is a SpreadElement (i.e.
// `[...x]`). The contents of the spread are not inspected — the
// syntactic shape `[...x].length` is the signal regardless of whether
// the spread source is statically a Set.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-size.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferSetSize struct{}

func (unicornPreferSetSize) Name() string { return "unicorn/prefer-set-size" }
func (unicornPreferSetSize) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (unicornPreferSetSize) Check(ctx *Context, node *shimast.Node) {
	access := node.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) != "length" {
		return
	}
	receiver := stripParens(access.Expression)
	if receiver == nil || receiver.Kind != shimast.KindArrayLiteralExpression {
		return
	}
	arr := receiver.AsArrayLiteralExpression()
	if arr == nil || arr.Elements == nil || len(arr.Elements.Nodes) != 1 {
		return
	}
	only := arr.Elements.Nodes[0]
	if only == nil || only.Kind != shimast.KindSpreadElement {
		return
	}
	ctx.Report(node, "Prefer `Set#size` over `[...set].length`.")
}

func init() {
	Register(unicornPreferSetSize{})
}
