// typescript/no-unnecessary-condition: a conditional whose test expression
// has a type that can only ever evaluate to one truthiness — `if ({})`,
// `if (null)`, `while ("")` — branches that never run (or always run) and
// almost always reflect a logic error. The runtime takes the static
// answer that the type system already had, so naming the constant intent
// explicitly (`if (true)`, deleting the dead arm, or widening the type)
// is the fix. typescript-eslint:
// https://typescript-eslint.io/rules/no-unnecessary-condition/
//
// Type-aware. Without a Checker the rule cannot tell `null` apart from
// `string | null`, so Context.Checker == nil short-circuits each Check to
// a no-op the way `strict-boolean-expressions` and `no-misused-promises`
// do.
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// truthState is the lattice value the rule tracks for each constituent of
// the test expression's static type.
//
//   - truthStateUnknowable — `any` / `unknown` / `never`, or any other
//     constituent we cannot prove either truthy or falsy. Treated as
//     "abandon the analysis" — if any constituent is unknowable the
//     overall result is unknowable and the rule does not fire.
//   - truthStateAlwaysTruthy / truthStateAlwaysFalsy — a constituent
//     whose runtime truthiness is fixed.
//   - truthStateMixed — a constituent that could be either (plain
//     `string`, plain `number`, plain `boolean`, enum, etc.). Reaching
//     "mixed" disqualifies the whole expression from the rule.
type truthState int

const (
	truthStateUnknowable truthState = iota
	truthStateAlwaysTruthy
	truthStateAlwaysFalsy
	truthStateMixed
)

type noUnnecessaryCondition struct{}

func (noUnnecessaryCondition) Name() string { return "typescript/no-unnecessary-condition" }
func (noUnnecessaryCondition) NeedsTypeChecker() bool {
	return true
}
func (noUnnecessaryCondition) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindIfStatement,
		shimast.KindWhileStatement,
		shimast.KindDoStatement,
		shimast.KindForStatement,
		shimast.KindConditionalExpression,
		shimast.KindBinaryExpression,
		shimast.KindPrefixUnaryExpression,
	}
}
func (noUnnecessaryCondition) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	switch node.Kind {
	case shimast.KindIfStatement:
		if stmt := node.AsIfStatement(); stmt != nil {
			noUnnecessaryConditionReport(ctx, stmt.Expression)
		}
	case shimast.KindWhileStatement:
		if stmt := node.AsWhileStatement(); stmt != nil {
			noUnnecessaryConditionReport(ctx, stmt.Expression)
		}
	case shimast.KindDoStatement:
		if stmt := node.AsDoStatement(); stmt != nil {
			noUnnecessaryConditionReport(ctx, stmt.Expression)
		}
	case shimast.KindForStatement:
		if stmt := node.AsForStatement(); stmt != nil {
			noUnnecessaryConditionReport(ctx, stmt.Condition)
		}
	case shimast.KindConditionalExpression:
		if expr := node.AsConditionalExpression(); expr != nil {
			noUnnecessaryConditionReport(ctx, expr.Condition)
		}
	case shimast.KindPrefixUnaryExpression:
		expr := node.AsPrefixUnaryExpression()
		if expr != nil && expr.Operator == shimast.KindExclamationToken {
			noUnnecessaryConditionReport(ctx, expr.Operand)
		}
	case shimast.KindBinaryExpression:
		bin := node.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil {
			return
		}
		// Only `&&` / `||` test their left operand for truthiness. `??`
		// short-circuits on nullish, not on falsy, and is intentionally
		// out of scope — its dedicated rule
		// `no-unnecessary-nullish-coalescing` covers that pattern.
		switch bin.OperatorToken.Kind {
		case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken:
			noUnnecessaryConditionReport(ctx, bin.Left)
		}
	}
}

// noUnnecessaryConditionReport flags `expr` when its static type proves
// the runtime truthiness is fixed. The descent through `&&` / `||`
// mirrors `strict-boolean-expressions`: the outer BinaryExpression visit
// only checks Left, so the recursion here picks up Right too. Wrapping
// parens are skipped via stripParens.
func noUnnecessaryConditionReport(ctx *Context, expr *shimast.Node) {
	if expr == nil {
		return
	}
	expr = stripParens(expr)
	if expr == nil {
		return
	}
	if expr.Kind == shimast.KindBinaryExpression {
		bin := expr.AsBinaryExpression()
		if bin != nil && bin.OperatorToken != nil {
			switch bin.OperatorToken.Kind {
			case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken:
				noUnnecessaryConditionReport(ctx, bin.Left)
				noUnnecessaryConditionReport(ctx, bin.Right)
				return
			}
		}
	}
	t := ctx.Checker.GetTypeAtLocation(expr)
	if t == nil {
		return
	}
	switch noUnnecessaryConditionEvaluate(ctx.Checker, t) {
	case truthStateAlwaysTruthy:
		ctx.Report(expr, "Unnecessary conditional, value is always truthy.")
	case truthStateAlwaysFalsy:
		ctx.Report(expr, "Unnecessary conditional, value is always falsy.")
	}
}

// noUnnecessaryConditionEvaluate folds a type into a single truthState by
// combining each constituent's state under union semantics: any
// unknowable constituent forces unknowable, otherwise the combined state
// is the unique truthy / falsy / mixed reading of every constituent.
// Intersections are not analyzed structurally — they bail to unknowable
// because the Checker may resolve them into shapes (e.g. branded
// primitives) the rule cannot reason about safely.
func noUnnecessaryConditionEvaluate(checker *shimchecker.Checker, t *shimchecker.Type) truthState {
	if checker == nil || t == nil {
		return truthStateUnknowable
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return truthStateUnknowable
	}
	if flags&shimchecker.TypeFlagsIntersection != 0 {
		// Intersections such as `Foo & { brand: "x" }` carry semantics the
		// rule cannot prove without a deeper Checker walk, so we keep the
		// conservative bail.
		return truthStateUnknowable
	}
	if flags&shimchecker.TypeFlagsUnion != 0 {
		parts := t.Types()
		if len(parts) == 0 {
			return truthStateUnknowable
		}
		combined := truthState(-1)
		for _, part := range parts {
			if part == nil {
				return truthStateUnknowable
			}
			state := noUnnecessaryConditionEvaluate(checker, part)
			if state == truthStateUnknowable || state == truthStateMixed {
				// A union with even one constituent we can't pin breaks the
				// "always X" guarantee — bail.
				return state
			}
			if combined == truthState(-1) {
				combined = state
				continue
			}
			if combined != state {
				// `string | null` has both a falsy ("") and a always-falsy
				// (null) outcome that disagree across constituents — fall
				// back to mixed so the rule stays silent.
				return truthStateMixed
			}
		}
		if combined == truthState(-1) {
			return truthStateUnknowable
		}
		return combined
	}
	// Atomic types.
	if flags&(shimchecker.TypeFlagsNull|shimchecker.TypeFlagsUndefined|shimchecker.TypeFlagsVoid) != 0 {
		return truthStateAlwaysFalsy
	}
	if flags&shimchecker.TypeFlagsBooleanLiteral != 0 {
		text := checker.TypeToString(t)
		if strings.TrimSpace(text) == "false" {
			return truthStateAlwaysFalsy
		}
		if strings.TrimSpace(text) == "true" {
			return truthStateAlwaysTruthy
		}
		return truthStateUnknowable
	}
	if flags&shimchecker.TypeFlagsStringLiteral != 0 {
		text := strings.TrimSpace(checker.TypeToString(t))
		if text == `""` || text == `''` {
			return truthStateAlwaysFalsy
		}
		return truthStateAlwaysTruthy
	}
	if flags&shimchecker.TypeFlagsNumberLiteral != 0 {
		text := strings.TrimSpace(checker.TypeToString(t))
		// `0`, `0.0`, `-0` all stringify as `0`; everything else is truthy.
		// `NaN` is not representable as a literal type, so it cannot reach
		// this branch.
		if text == "0" {
			return truthStateAlwaysFalsy
		}
		return truthStateAlwaysTruthy
	}
	if flags&shimchecker.TypeFlagsBigIntLiteral != 0 {
		text := strings.TrimSpace(checker.TypeToString(t))
		if text == "0n" {
			return truthStateAlwaysFalsy
		}
		return truthStateAlwaysTruthy
	}
	if flags&shimchecker.TypeFlagsObject != 0 {
		// A non-nullable object value is always truthy. `{}`, arrays,
		// class instances, functions, and structural records all share
		// this contract; only `null` / `undefined` make an object position
		// falsy and those flags route to the always-falsy branch above.
		return truthStateAlwaysTruthy
	}
	// Plain `string` / `number` / `boolean` / `bigint` / enum / symbol /
	// type parameter / index / template literal — every one of these can
	// hold both truthy and falsy values (or escapes static reasoning), so
	// the rule must stay silent.
	return truthStateMixed
}

func init() {
	Register(noUnnecessaryCondition{})
}
