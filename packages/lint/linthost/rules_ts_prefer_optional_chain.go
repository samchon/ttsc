// preferOptionalChain reports `a && a.b` / `a && a.b && a.b.c` and
// `a != null && a.b` chained boolean patterns and suggests `a?.b?.c`.
// The optional-chain form is shorter and short-circuits to `undefined`
// instead of the leftmost falsy value, which is almost always what the
// author wanted when guarding a property access against a nullish base.
//
// This is the AST-only baseline: the rule fires when the receiver of
// the right-hand member access textually starts with the left-hand
// guard expression. Cases where the chain crosses through a call
// expression with arguments are skipped — those have observable side
// effects, so the `?.` form is not equivalent.
// https://typescript-eslint.io/rules/prefer-optional-chain/
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type preferOptionalChain struct{}

func (preferOptionalChain) Name() string { return "typescript/prefer-optional-chain" }
func (preferOptionalChain) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (preferOptionalChain) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindAmpersandAmpersandToken {
		return
	}
	// Skip when the binary expression is itself the left side of an
	// outer `&&` — the outer node will be visited and report the full
	// chain. Reporting at every inner conjunct would flood `a && a.b
	// && a.b.c` with two diagnostics on the same chain.
	if parent := node.Parent; parent != nil && parent.Kind == shimast.KindBinaryExpression {
		pe := parent.AsBinaryExpression()
		if pe != nil && pe.OperatorToken != nil &&
			pe.OperatorToken.Kind == shimast.KindAmpersandAmpersandToken &&
			pe.Left == node {
			return
		}
	}
	guardText, ok := preferOptionalChainGuardText(ctx, expr.Left)
	if !ok {
		return
	}
	right := stripParens(expr.Right)
	if !preferOptionalChainRightMatches(ctx, right, guardText) {
		return
	}
	ctx.Report(node, "Prefer an optional chain (`a?.b`) over `a && a.b` — shorter and short-circuits to `undefined` instead of the leftmost falsy value.")
}

// preferOptionalChainRightmostConjunct returns the rightmost operand
// of a left-associative `&&` chain. For `(a && a.b) && a.b.c` the
// rightmost conjunct of the left is `a.b`, which is the immediate
// guard the outer `&&` was extending.
func preferOptionalChainRightmostConjunct(node *shimast.Node) *shimast.Node {
	node = stripParens(node)
	for node != nil && node.Kind == shimast.KindBinaryExpression {
		inner := node.AsBinaryExpression()
		if inner == nil || inner.OperatorToken == nil ||
			inner.OperatorToken.Kind != shimast.KindAmpersandAmpersandToken ||
			inner.Right == nil {
			return node
		}
		node = stripParens(inner.Right)
	}
	return node
}

// preferOptionalChainGuardText returns the textual identity of the
// guard expression on the left of `&&`. The guard may be an identifier
// (`a && a.b`), a property access (`a.b && a.b.c`), or a `!= null` /
// `!== null` / `!== undefined` comparison (`a != null && a.b`). For the
// comparison form, the returned text is the non-null side, which is
// what the right-hand access must start with.
func preferOptionalChainGuardText(ctx *Context, left *shimast.Node) (string, bool) {
	left = stripParens(left)
	if left == nil {
		return "", false
	}
	switch left.Kind {
	case shimast.KindIdentifier, shimast.KindPropertyAccessExpression:
		text := nodeText(ctx.File, left)
		return text, text != ""
	case shimast.KindBinaryExpression:
		inner := left.AsBinaryExpression()
		if inner == nil || inner.OperatorToken == nil {
			return "", false
		}
		// Chain extension: `(x && a.b) && a.b.c` — peel down to the
		// rightmost conjunct (`a.b`) and use it as the guard against
		// the outer right side.
		if inner.OperatorToken.Kind == shimast.KindAmpersandAmpersandToken {
			conjunct := preferOptionalChainRightmostConjunct(left)
			if conjunct == nil {
				return "", false
			}
			switch conjunct.Kind {
			case shimast.KindIdentifier, shimast.KindPropertyAccessExpression:
				text := nodeText(ctx.File, conjunct)
				return text, text != ""
			}
			return "", false
		}
		if inner.OperatorToken.Kind != shimast.KindExclamationEqualsToken &&
			inner.OperatorToken.Kind != shimast.KindExclamationEqualsEqualsToken {
			return "", false
		}
		lhs := stripParens(inner.Left)
		rhs := stripParens(inner.Right)
		if subject, ok := preferOptionalChainNullishCompareSubject(ctx, lhs, rhs); ok {
			return subject, true
		}
		if subject, ok := preferOptionalChainNullishCompareSubject(ctx, rhs, lhs); ok {
			return subject, true
		}
	}
	return "", false
}

// preferOptionalChainNullishCompareSubject returns the textual identity
// of `subject` when `nullish` is `null` or `undefined` and `subject` is
// an identifier or property access. Returns the empty text otherwise.
func preferOptionalChainNullishCompareSubject(
	ctx *Context,
	subject, nullish *shimast.Node,
) (string, bool) {
	if subject == nil || nullish == nil {
		return "", false
	}
	if !preferOptionalChainIsNullOrUndefined(nullish) {
		return "", false
	}
	switch subject.Kind {
	case shimast.KindIdentifier, shimast.KindPropertyAccessExpression:
		text := nodeText(ctx.File, subject)
		return text, text != ""
	}
	return "", false
}

// preferOptionalChainIsNullOrUndefined reports whether node is the
// `null` keyword or the `undefined` identifier.
func preferOptionalChainIsNullOrUndefined(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	if node.Kind == shimast.KindNullKeyword {
		return true
	}
	if node.Kind == shimast.KindIdentifier {
		return identifierText(node) == "undefined"
	}
	return false
}

// preferOptionalChainRightMatches reports whether `right` is a
// property access or call expression whose receiver textually starts
// with `guardText` followed by `.` or `[`. Calls with arguments are
// rejected — the `?.` rewrite would not preserve side-effect ordering
// when the arguments themselves can have side effects.
func preferOptionalChainRightMatches(
	ctx *Context,
	right *shimast.Node,
	guardText string,
) bool {
	if right == nil || guardText == "" {
		return false
	}
	switch right.Kind {
	case shimast.KindPropertyAccessExpression:
		access := right.AsPropertyAccessExpression()
		if access == nil || access.Expression == nil {
			return false
		}
		return preferOptionalChainHasPrefix(ctx, right, guardText)
	case shimast.KindCallExpression:
		call := right.AsCallExpression()
		if call == nil || call.Expression == nil {
			return false
		}
		// Skip calls with arguments — their evaluation cannot be
		// observed identically through `?.()`.
		if call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
			return false
		}
		// The callee receiver must itself be a property access; a
		// bare identifier call (`a()`) has no chain to fold.
		callee := stripParens(call.Expression)
		if callee == nil || callee.Kind != shimast.KindPropertyAccessExpression {
			return false
		}
		return preferOptionalChainHasPrefix(ctx, right, guardText)
	}
	return false
}

// preferOptionalChainHasPrefix returns whether the textual form of
// `node` begins with `guard` followed by a `.` or `[` — the only
// continuations that mean "a property of the guarded value".
func preferOptionalChainHasPrefix(
	ctx *Context,
	node *shimast.Node,
	guard string,
) bool {
	text := nodeText(ctx.File, node)
	if !strings.HasPrefix(text, guard) {
		return false
	}
	if len(text) == len(guard) {
		return false
	}
	switch text[len(guard)] {
	case '.', '[', '(':
		return true
	}
	return false
}

func init() {
	Register(preferOptionalChain{})
}
