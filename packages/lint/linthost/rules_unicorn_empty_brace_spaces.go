// unicorn/empty-brace-spaces: an empty block `{ }` or empty object
// literal `{ }` written with whitespace between the braces wastes a
// column of source for no semantic effect. The rule collapses the two
// braces so the canonical empty form is `{}`.
//
// AST-only: visit both `Block` and `ObjectLiteralExpression`. The match
// fires when the node is empty (zero statements / zero properties) AND
// the source text between the opening `{` and closing `}` contains at
// least one whitespace byte. The whitespace check uses the source-file
// byte buffer directly because the AST itself elides the inter-token
// whitespace.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/empty-brace-spaces.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornEmptyBraceSpaces struct{}

func (unicornEmptyBraceSpaces) Name() string { return "unicorn/empty-brace-spaces" }
func (unicornEmptyBraceSpaces) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBlock, shimast.KindObjectLiteralExpression}
}
func (unicornEmptyBraceSpaces) Check(ctx *Context, node *shimast.Node) {
	if ctx.File == nil {
		return
	}
	switch node.Kind {
	case shimast.KindBlock:
		block := node.AsBlock()
		if block == nil || block.Statements == nil || len(block.Statements.Nodes) > 0 {
			return
		}
	case shimast.KindObjectLiteralExpression:
		obj := node.AsObjectLiteralExpression()
		if obj == nil || obj.Properties == nil || len(obj.Properties.Nodes) > 0 {
			return
		}
	default:
		return
	}
	src := ctx.File.Text()
	_, end := tokenRange(ctx.File, node)
	pos := node.Pos()
	if pos < 0 || end < 0 || end > len(src) {
		return
	}
	// Locate the opening `{` after any leading trivia.
	open := -1
	for i := pos; i < end; i++ {
		if src[i] == '{' {
			open = i
			break
		}
	}
	if open < 0 || end-1 <= open {
		return
	}
	// The closing `}` is the byte immediately before End().
	if src[end-1] != '}' {
		return
	}
	for i := open + 1; i < end-1; i++ {
		switch src[i] {
		case ' ', '\t', '\r', '\n':
			ctx.Report(node, "Empty braces shouldn't contain whitespace.")
			return
		}
	}
}

func init() {
	Register(unicornEmptyBraceSpaces{})
}
