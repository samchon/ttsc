package lint

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// nodeText returns the source text under a node, with leading trivia
// stripped. Useful for rules that compare textual identity (e.g.
// `no-self-compare`, `no-self-assign`).
//
// We use the *node*'s Pos which points to the start of leading trivia;
// the substring is trimmed left-most so comparisons are stable.
func nodeText(file *shimast.SourceFile, node *shimast.Node) string {
	if file == nil || node == nil {
		return ""
	}
	src := file.Text()
	pos := node.Pos()
	end := node.End()
	if pos < 0 || end > len(src) || pos >= end {
		return ""
	}
	return strings.TrimLeft(src[pos:end], " \t\r\n")
}

// identifierText returns the lexical name of an Identifier node, or "" if
// the node isn't an Identifier.
func identifierText(node *shimast.Node) string {
	if node == nil || node.Kind != shimast.KindIdentifier {
		return ""
	}
	id := node.AsIdentifier()
	if id == nil {
		return ""
	}
	return id.Text
}

// stripParens descends through ParenthesizedExpression nodes and returns
// the first non-parenthesized child. ESLint rules typically operate on
// the canonical form.
func stripParens(node *shimast.Node) *shimast.Node {
	for node != nil && node.Kind == shimast.KindParenthesizedExpression {
		next := node.AsParenthesizedExpression()
		if next == nil || next.Expression == nil {
			return node
		}
		node = next.Expression
	}
	return node
}

// isMatchingPropertyAccess reports whether `node` reads the chain
// `head.tail[0].tail[1]…`. Useful for detecting `obj.__proto__` or
// `console.log` shapes regardless of nesting.
func isMatchingPropertyAccess(node *shimast.Node, head string, tail ...string) bool {
	if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
		return false
	}
	chain := []*shimast.Node{}
	cur := node
	for cur != nil && cur.Kind == shimast.KindPropertyAccessExpression {
		access := cur.AsPropertyAccessExpression()
		if access == nil {
			return false
		}
		chain = append([]*shimast.Node{access.Name()}, chain...)
		cur = access.Expression
	}
	if cur == nil || identifierText(cur) != head {
		return false
	}
	if len(chain) != len(tail) {
		return false
	}
	for i, want := range tail {
		if identifierText(chain[i]) != want {
			return false
		}
	}
	return true
}

// isLiteralBoolean returns the boolean value (and ok=true) for a
// `KindTrueKeyword` / `KindFalseKeyword` literal. Other nodes return
// (false, false).
func isLiteralBoolean(node *shimast.Node) (bool, bool) {
	if node == nil {
		return false, false
	}
	switch node.Kind {
	case shimast.KindTrueKeyword:
		return true, true
	case shimast.KindFalseKeyword:
		return false, true
	}
	return false, false
}

// isLiteralExpression returns true for nodes whose value is intrinsically
// truthy / falsy at parse time — these flag `no-constant-condition` etc.
func isLiteralExpression(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case
		shimast.KindStringLiteral,
		shimast.KindNumericLiteral,
		shimast.KindBigIntLiteral,
		shimast.KindNoSubstitutionTemplateLiteral,
		shimast.KindRegularExpressionLiteral,
		shimast.KindTrueKeyword,
		shimast.KindFalseKeyword,
		shimast.KindNullKeyword:
		return true
	}
	return false
}

// callCalleeName returns the simple-identifier callee of a CallExpression
// (e.g. `eval` from `eval("...")`). Returns "" when the callee is more
// complex than a bare identifier.
func callCalleeName(call *shimast.CallExpression) string {
	if call == nil || call.Expression == nil {
		return ""
	}
	return identifierText(call.Expression)
}

// numericLiteralText returns the literal text of a numeric / bigint
// literal, normalized for the comparisons rules need (`-0`, `0xFF`).
func numericLiteralText(node *shimast.Node) string {
	if node == nil {
		return ""
	}
	switch node.Kind {
	case shimast.KindNumericLiteral:
		if lit := node.AsNumericLiteral(); lit != nil {
			return lit.Text
		}
	case shimast.KindBigIntLiteral:
		if lit := node.AsBigIntLiteral(); lit != nil {
			return lit.Text
		}
	}
	return ""
}

// stringLiteralText returns the value of a string-shaped literal:
// StringLiteral or NoSubstitutionTemplateLiteral.
func stringLiteralText(node *shimast.Node) string {
	if node == nil {
		return ""
	}
	switch node.Kind {
	case shimast.KindStringLiteral:
		if lit := node.AsStringLiteral(); lit != nil {
			return lit.Text
		}
	case shimast.KindNoSubstitutionTemplateLiteral:
		if lit := node.AsNoSubstitutionTemplateLiteral(); lit != nil {
			return lit.Text
		}
	}
	return ""
}
