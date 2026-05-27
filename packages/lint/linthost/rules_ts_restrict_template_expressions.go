// typescript/restrict-template-expressions: every interpolation inside a
// template literal coerces its value through `String()` at runtime, so
// non-string-friendly types silently render as `"[object Object]"`,
// `"null"`, or `"undefined"`. The rule requires each embedded expression
// to be statically known as `string`, `number`, `bigint`, `boolean`, or
// a union of those — anything else (object types, `null`, `undefined`,
// `void`) must be converted explicitly at the call site.
// typescript-eslint:
// https://typescript-eslint.io/rules/restrict-template-expressions/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// restrictTemplateExpressions reports each `${expr}` span inside a
// template literal whose expression has a non-stringy static type.
// Type-aware: without a Checker the rule cannot tell `string | number`
// apart from `string | null`, so it bails — the AST alone never has
// enough information to decide this case.
//
// `any` / `unknown` / `never` pass through on purpose. They propagate
// from generic helpers and a strict rejection would explode the
// false-positive volume; the upstream rule makes the same choice
// behind its `allowAny` / `allowNever` options, which default to true.
type restrictTemplateExpressions struct{}

func (restrictTemplateExpressions) Name() string {
	return "typescript/restrict-template-expressions"
}
func (restrictTemplateExpressions) NeedsTypeChecker() bool {
	return true
}
func (restrictTemplateExpressions) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindTemplateExpression}
}
func (restrictTemplateExpressions) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	expr := node.AsTemplateExpression()
	if expr == nil || expr.TemplateSpans == nil {
		return
	}
	for _, spanNode := range expr.TemplateSpans.Nodes {
		span := spanNode.AsTemplateSpan()
		if span == nil || span.Expression == nil {
			continue
		}
		t := ctx.Checker.GetTypeAtLocation(span.Expression)
		if t == nil {
			continue
		}
		if restrictTemplateExpressionsIsStringy(ctx.Checker, t) {
			continue
		}
		ctx.Report(span.Expression, "Template interpolations must be string-like (`string`, `number`, `bigint`, or `boolean`) — convert the value explicitly to avoid coercing to `\"[object Object]\"`, `\"null\"`, or `\"undefined\"`.")
	}
}

// restrictTemplateExpressionsIsStringy reports whether t is safe to
// drop into a template-literal slot — string / number / bigint /
// boolean, or a union/intersection whose every constituent is.
// `any` / `unknown` / `never` pass through (return true) so generic
// helpers propagate without lighting up the rule everywhere.
func restrictTemplateExpressionsIsStringy(checker *shimchecker.Checker, t *shimchecker.Type) bool {
	if checker == nil || t == nil {
		return false
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return true
	}
	if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
		for _, part := range t.Types() {
			if part == nil {
				continue
			}
			if !restrictTemplateExpressionsIsStringy(checker, part) {
				return false
			}
		}
		return true
	}
	const stringyMask = shimchecker.TypeFlagsStringLike |
		shimchecker.TypeFlagsNumberLike |
		shimchecker.TypeFlagsBigIntLike |
		shimchecker.TypeFlagsBooleanLike
	return flags&stringyMask != 0
}

func init() {
	Register(restrictTemplateExpressions{})
}
