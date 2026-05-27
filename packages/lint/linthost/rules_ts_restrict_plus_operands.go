// typescript/restrict-plus-operands: the `+` operator is overloaded in
// JavaScript — it numerically adds two numbers, lexically concatenates
// two strings, and silently coerces every other combination. `1 + "a"`
// becomes `"1a"`, `null + 5` becomes `5`, `{} + 1` becomes `"[object
// Object]1"`. Each of these is almost always a bug: the author meant
// either numeric addition or explicit string concatenation, not the
// runtime's lossy fallback. typescript-eslint:
// https://typescript-eslint.io/rules/restrict-plus-operands/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// restrictPlusOperands fires on `<lhs> + <rhs>` when the operands are
// not both number-like, both string-like, or both bigint-like. The
// rule is type-aware: without a Checker it cannot prove the operand
// kinds, so it bails out to avoid false positives on plain JS or on
// files that opt out of typechecking. `any` / `unknown` / `never`
// operands are treated as unrestricted to keep false positives off
// generic helpers; the upstream rule does the same.
type restrictPlusOperands struct{}

func (restrictPlusOperands) Name() string { return "typescript/restrict-plus-operands" }
func (restrictPlusOperands) NeedsTypeChecker() bool {
	return true
}
func (restrictPlusOperands) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindBinaryExpression}
}
func (restrictPlusOperands) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindPlusToken {
		return
	}
	if expr.Left == nil || expr.Right == nil {
		return
	}
	left := ctx.Checker.GetTypeAtLocation(expr.Left)
	right := ctx.Checker.GetTypeAtLocation(expr.Right)
	if left == nil || right == nil {
		return
	}
	leftKind := restrictPlusOperandsKind(left)
	rightKind := restrictPlusOperandsKind(right)
	// Skip when either side is unconstrained (any / unknown / never /
	// generic) — the rule would otherwise fire on every generic helper
	// that accepts `T extends number | string`.
	if leftKind == restrictPlusOperandsAny || rightKind == restrictPlusOperandsAny {
		return
	}
	if leftKind == rightKind && leftKind != restrictPlusOperandsOther {
		return
	}
	ctx.Report(node, "Operands of `+` must both be `number`, both `string`, or both `bigint`. Mixed or non-primitive operands are silently coerced by the runtime and almost always a bug.")
}

// restrictPlusOperandsKind classifies t as one of the four buckets the
// rule cares about. A union is accepted only when every constituent
// lands in the same primitive bucket — `string | number` is
// deliberately rejected because each branch would coerce the other
// side differently at runtime.
type restrictPlusOperandsBucket int

const (
	restrictPlusOperandsOther restrictPlusOperandsBucket = iota
	restrictPlusOperandsAny
	restrictPlusOperandsNumber
	restrictPlusOperandsString
	restrictPlusOperandsBigInt
)

func restrictPlusOperandsKind(t *shimchecker.Type) restrictPlusOperandsBucket {
	if t == nil {
		return restrictPlusOperandsOther
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return restrictPlusOperandsAny
	}
	if flags&shimchecker.TypeFlagsStringLike != 0 {
		return restrictPlusOperandsString
	}
	if flags&shimchecker.TypeFlagsNumberLike != 0 {
		return restrictPlusOperandsNumber
	}
	if flags&shimchecker.TypeFlagsBigIntLike != 0 {
		return restrictPlusOperandsBigInt
	}
	if flags&shimchecker.TypeFlagsUnion != 0 {
		var seen restrictPlusOperandsBucket
		for _, part := range t.Types() {
			if part == nil {
				continue
			}
			kind := restrictPlusOperandsKind(part)
			if kind == restrictPlusOperandsAny {
				return restrictPlusOperandsAny
			}
			if kind == restrictPlusOperandsOther {
				return restrictPlusOperandsOther
			}
			if seen == 0 {
				seen = kind
				continue
			}
			if seen != kind {
				return restrictPlusOperandsOther
			}
		}
		if seen != 0 {
			return seen
		}
	}
	return restrictPlusOperandsOther
}

func init() {
	Register(restrictPlusOperands{})
}
