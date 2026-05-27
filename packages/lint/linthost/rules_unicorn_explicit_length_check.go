// unicorn/explicit-length-check: `.length` (or `.size`) coerced to
// boolean (`if (xs.length) …`) reads as "is the array truthy" rather
// than "does the array have elements". A reader has to know that
// `.length` is a number and that `0` is the only falsy value to
// reconstruct the intent. Explicit comparisons (`xs.length > 0`,
// `xs.length === 0`) put the predicate on the page. The rule fires
// when a `.length`/`.size` property access sits in a boolean context.
//
// AST-only: visit `KindPropertyAccessExpression`, accept when the
// property name is `length` or `size`, and check whether the (possibly
// parenthesized) node sits as the test of an `if`/`while`/`for`/
// conditional, as the operand of `!`, or as a side of a logical
// `&&`/`||`/`??` chain. The boolean-context walk reuses the parent
// traversal pattern from `rules_logic.go::isInBooleanContext`.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/explicit-length-check.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornExplicitLengthCheck struct{}

func (unicornExplicitLengthCheck) Name() string { return "unicorn/explicit-length-check" }
func (unicornExplicitLengthCheck) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (unicornExplicitLengthCheck) Check(ctx *Context, node *shimast.Node) {
	access := node.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	name := identifierText(access.Name())
	if name != "length" && name != "size" {
		return
	}
	if !unicornExplicitLengthCheckIsBooleanContext(node) {
		return
	}
	ctx.Report(node, "Use an explicit comparison (`.length > 0` or `.length === 0`) instead of truthy coercion.")
}

// unicornExplicitLengthCheckIsBooleanContext walks the parent chain to
// see whether the value of `node` is consumed as a boolean — the test
// position of a control-flow statement / ternary, the operand of `!`,
// or one side of a logical (`&&` / `||` / `??`) chain.
func unicornExplicitLengthCheckIsBooleanContext(node *shimast.Node) bool {
	cur := node
	for cur != nil && cur.Parent != nil && cur.Parent.Kind == shimast.KindParenthesizedExpression {
		cur = cur.Parent
	}
	if cur == nil {
		return false
	}
	parent := cur.Parent
	if parent == nil {
		return false
	}
	switch parent.Kind {
	case shimast.KindIfStatement:
		return parent.AsIfStatement().Expression == cur
	case shimast.KindWhileStatement:
		return parent.AsWhileStatement().Expression == cur
	case shimast.KindDoStatement:
		return parent.AsDoStatement().Expression == cur
	case shimast.KindForStatement:
		return parent.AsForStatement().Condition == cur
	case shimast.KindConditionalExpression:
		return parent.AsConditionalExpression().Condition == cur
	case shimast.KindPrefixUnaryExpression:
		return parent.AsPrefixUnaryExpression().Operator == shimast.KindExclamationToken
	case shimast.KindBinaryExpression:
		bin := parent.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil {
			return false
		}
		switch bin.OperatorToken.Kind {
		case shimast.KindAmpersandAmpersandToken,
			shimast.KindBarBarToken,
			shimast.KindQuestionQuestionToken:
			return true
		}
	}
	return false
}

func init() {
	Register(unicornExplicitLengthCheck{})
}
