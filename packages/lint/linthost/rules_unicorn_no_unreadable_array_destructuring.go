// unicorn/no-unreadable-array-destructuring: a destructuring pattern
// like `[, , a]` uses a run of comma holes to skip array positions
// before the binding the caller actually wants. The hole run is
// positional, silent, and trivial to miscount, so the rule flags
// patterns with two or more consecutive holes followed by a real
// element. A single leading hole (`[, second]`) is a common idiom and
// is not flagged. The recommended replacement is an indexed read
// (`arr[2]`).
//
// AST-only and syntactic: dispatch on `ArrayBindingPattern` for
// declaration / parameter destructuring AND `ArrayLiteralExpression`
// for the assignment-destructuring form (which the parser models as an
// array literal in LHS position). A run of three or more
// `OmittedExpression` holes followed by a non-hole element trips the
// diagnostic; runs that are not followed by anything (trailing holes)
// are not actionable and are out of scope.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unreadable-array-destructuring.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnreadableArrayDestructuring struct{}

func (unicornNoUnreadableArrayDestructuring) Name() string {
	return "unicorn/no-unreadable-array-destructuring"
}
func (unicornNoUnreadableArrayDestructuring) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindArrayBindingPattern, shimast.KindArrayLiteralExpression}
}
func (unicornNoUnreadableArrayDestructuring) Check(ctx *Context, node *shimast.Node) {
	var elements []*shimast.Node
	switch node.Kind {
	case shimast.KindArrayBindingPattern:
		pattern := node.AsBindingPattern()
		if pattern == nil || pattern.Elements == nil {
			return
		}
		elements = pattern.Elements.Nodes
	case shimast.KindArrayLiteralExpression:
		// Array literals fire only when they appear in a destructuring-
		// assignment position; otherwise the holes are just sparse-array
		// construction, which a different rule covers.
		if !isAssignmentDestructuringTarget(node) {
			return
		}
		arr := node.AsArrayLiteralExpression()
		if arr == nil || arr.Elements == nil {
			return
		}
		elements = arr.Elements.Nodes
	default:
		return
	}
	run := 0
	for _, el := range elements {
		if isArrayDestructuringHole(el) {
			run++
			continue
		}
		if run >= 2 {
			ctx.Report(node, "Don't use unreadable array destructuring with long hole runs.")
			return
		}
		run = 0
	}
}

// isArrayDestructuringHole reports whether `el` is a comma "hole" in an
// array destructuring/literal context. The TypeScript parser models a
// hole in an `ArrayLiteralExpression` as `OmittedExpression`, but a
// hole in an `ArrayBindingPattern` as a `BindingElement` with no name
// (and no initializer / dotdotdot). Both shapes contribute to a run.
func isArrayDestructuringHole(el *shimast.Node) bool {
	if el == nil {
		return false
	}
	if el.Kind == shimast.KindOmittedExpression {
		return true
	}
	if el.Kind == shimast.KindBindingElement {
		be := el.AsBindingElement()
		if be != nil && be.Name() == nil && be.Initializer == nil && be.DotDotDotToken == nil {
			return true
		}
	}
	return false
}

// isAssignmentDestructuringTarget reports whether `node` (an
// ArrayLiteralExpression) appears on the LHS of an `=` assignment or
// in another write-target position. The parser models destructuring
// assignment as an array-literal expression in LHS slot; without this
// gate every plain sparse array literal would trip the rule.
func isAssignmentDestructuringTarget(node *shimast.Node) bool {
	parent := node.Parent
	for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
		parent = parent.Parent
	}
	if parent == nil {
		return false
	}
	if parent.Kind == shimast.KindBinaryExpression {
		bin := parent.AsBinaryExpression()
		if bin != nil && bin.OperatorToken != nil &&
			bin.OperatorToken.Kind == shimast.KindEqualsToken &&
			stripParens(bin.Left) == node {
			return true
		}
	}
	return false
}

func init() {
	Register(unicornNoUnreadableArrayDestructuring{})
}
