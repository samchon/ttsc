// typescript/no-unnecessary-template-expression: a backtick literal
// that carries no template-only behavior is just noise — a regular
// string literal renders the same characters with one fewer indirection.
// typescript-eslint:
// https://typescript-eslint.io/rules/no-unnecessary-template-expression/
//
// Type-aware. Three shapes collapse cleanly to a regular string literal:
//
//   - A `NoSubstitutionTemplateLiteral` with no escaped backticks. The
//     `\`` escape is what would force the template form once converted —
//     a regular `"..."` does not need to escape a backtick, but the
//     surrounding lint expects an exact source-preserving rewrite, so
//     skip the literal when one is present.
//   - A `TemplateExpression` whose head and the one span's tail text are
//     both empty AND whose single span's expression is statically
//     string-typed. `` `${name}` `` then coerces a known-string value
//     through `String()` for no reason; just use `name`.
//   - A `TemplateExpression` whose single span's expression is a
//     `StringLiteral` or `NoSubstitutionTemplateLiteral` literal and
//     whose head / tail text are empty — `` `${"abc"}` `` is the same
//     as `"abc"`, independent of any Checker state.
//
// Tagged templates (`` tag`abc` ``, `` tag`${x}` ``) are excluded
// because the tag function reads the raw template payload and would
// observe a different shape if the literal were rewritten to a string.
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noUnnecessaryTemplateExpression struct{}

func (noUnnecessaryTemplateExpression) Name() string {
	return "typescript/no-unnecessary-template-expression"
}
func (noUnnecessaryTemplateExpression) NeedsTypeChecker() bool {
	return true
}
func (noUnnecessaryTemplateExpression) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindNoSubstitutionTemplateLiteral,
		shimast.KindTemplateExpression,
	}
}
func (noUnnecessaryTemplateExpression) Check(ctx *Context, node *shimast.Node) {
	// Tag-function readers (`String.raw`, `dedent`, `gql`, `css`, …) see
	// the raw template payload, so rewriting to a string literal would
	// change observable behavior. Skip the entire literal in that case,
	// matching `no-useless-escape`.
	if isInsideTaggedTemplate(node) {
		return
	}
	switch node.Kind {
	case shimast.KindNoSubstitutionTemplateLiteral:
		lit := node.AsNoSubstitutionTemplateLiteral()
		if lit == nil {
			return
		}
		// `RawText` is the verbatim payload between the backticks. The
		// presence of `\`` means the source intentionally escapes a
		// backtick that the template-literal form requires; leave such
		// literals alone so the rewrite is always a pure source change.
		if strings.Contains(lit.RawText, "\\`") {
			return
		}
		ctx.Report(node, noUnnecessaryTemplateExpressionMessage)
	case shimast.KindTemplateExpression:
		expr := node.AsTemplateExpression()
		if expr == nil || expr.TemplateSpans == nil {
			return
		}
		spans := expr.TemplateSpans.Nodes
		if len(spans) != 1 {
			return
		}
		// Head text must be empty: `` `prefix${...}` `` has surrounding
		// chars that are load-bearing and cannot collapse.
		head := expr.Head
		if head == nil || templateLiteralLikeText(head) != "" {
			return
		}
		span := spans[0].AsTemplateSpan()
		if span == nil || span.Expression == nil || span.Literal == nil {
			return
		}
		// Tail text must be empty for the same reason as the head.
		if templateLiteralLikeText(span.Literal) != "" {
			return
		}
		inner := span.Expression
		// A literal string operand collapses without consulting the
		// Checker — `` `${"abc"}` `` is identical to `"abc"`.
		if inner.Kind == shimast.KindStringLiteral ||
			inner.Kind == shimast.KindNoSubstitutionTemplateLiteral {
			ctx.Report(node, noUnnecessaryTemplateExpressionMessage)
			return
		}
		if ctx.Checker == nil {
			return
		}
		t := ctx.Checker.GetTypeAtLocation(inner)
		if t == nil {
			return
		}
		if isStringTypedForTemplateCollapse(t) {
			ctx.Report(node, noUnnecessaryTemplateExpressionMessage)
		}
	}
}

const noUnnecessaryTemplateExpressionMessage = "Unnecessary template literal — replace the backtick form with a regular string literal."

// templateLiteralLikeText returns the parsed text payload of a
// TemplateHead / TemplateMiddle / TemplateTail / NoSubstitutionTemplate-
// Literal node. The same `Text` field lives on every shape via the
// shared `TemplateLiteralLikeNodeBase`, so we dispatch by kind.
func templateLiteralLikeText(node *shimast.Node) string {
	if node == nil {
		return ""
	}
	switch node.Kind {
	case shimast.KindTemplateHead:
		if h := node.AsTemplateHead(); h != nil {
			return h.Text
		}
	case shimast.KindTemplateMiddle:
		if m := node.AsTemplateMiddle(); m != nil {
			return m.Text
		}
	case shimast.KindTemplateTail:
		if tl := node.AsTemplateTail(); tl != nil {
			return tl.Text
		}
	case shimast.KindNoSubstitutionTemplateLiteral:
		if l := node.AsNoSubstitutionTemplateLiteral(); l != nil {
			return l.Text
		}
	}
	return ""
}

// isStringTypedForTemplateCollapse reports whether `t` is provably a
// string-like type whose interpolation in `` `${x}` `` is a no-op
// coercion. `any` / `unknown` / `never` are deliberately excluded so the
// rule does not light up on generic helpers — the upstream rule's
// `allowAny` semantics match this conservative choice. Union and
// intersection types collapse only when every constituent is itself
// string-like.
func isStringTypedForTemplateCollapse(t *shimchecker.Type) bool {
	if t == nil {
		return false
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return false
	}
	if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
		parts := t.Types()
		if len(parts) == 0 {
			return false
		}
		for _, part := range parts {
			if !isStringTypedForTemplateCollapse(part) {
				return false
			}
		}
		return true
	}
	return flags&shimchecker.TypeFlagsStringLike != 0
}

func init() {
	Register(noUnnecessaryTemplateExpression{})
}
