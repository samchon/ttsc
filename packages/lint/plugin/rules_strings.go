package main

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// no-template-curly-in-string: a regular string contains `${...}`. The
// developer probably meant a template literal.
// https://eslint.org/docs/latest/rules/no-template-curly-in-string
type noTemplateCurlyInString struct{}

func (noTemplateCurlyInString) Name() string { return "no-template-curly-in-string" }
func (noTemplateCurlyInString) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindStringLiteral}
}
func (noTemplateCurlyInString) Check(ctx *Context, node *shimast.Node) {
	text := stringLiteralText(node)
	if hasTemplatePlaceholder(text) {
		ctx.Report(node, "Unexpected template string expression in regular string.")
	}
}

func hasTemplatePlaceholder(text string) bool {
	if !strings.Contains(text, "${") {
		return false
	}
	// Match `${ ... }` style, not just literal "${" with nothing after.
	idx := strings.Index(text, "${")
	for idx >= 0 {
		rest := text[idx+2:]
		if strings.Contains(rest, "}") {
			return true
		}
		next := strings.Index(text[idx+1:], "${")
		if next < 0 {
			return false
		}
		idx += next + 1
	}
	return false
}

// no-multi-str: `"line one \\n line two"` style backslash continuations.
// TS strips them silently and the result is rarely what the author meant.
// https://eslint.org/docs/latest/rules/no-multi-str
type noMultiStr struct{}

func (noMultiStr) Name() string           { return "no-multi-str" }
func (noMultiStr) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindStringLiteral} }
func (noMultiStr) Check(ctx *Context, node *shimast.Node) {
	src := nodeText(ctx.File, node)
	// Look for `\` immediately before a newline in the *raw* source text.
	if hasBackslashLineContinuation(src) {
		ctx.Report(node, "Multiline support is limited to comments.")
	}
}

func hasBackslashLineContinuation(src string) bool {
	for i := 0; i < len(src)-1; i++ {
		if src[i] == '\\' {
			next := src[i+1]
			if next == '\n' || next == '\r' {
				return true
			}
		}
	}
	return false
}

// no-useless-concat: `"a" + "b"` of two literals. The compiler can't
// constant-fold every case, but this catches the obvious shapes.
// https://eslint.org/docs/latest/rules/no-useless-concat
type noUselessConcat struct{}

func (noUselessConcat) Name() string           { return "no-useless-concat" }
func (noUselessConcat) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }
func (noUselessConcat) Check(ctx *Context, node *shimast.Node) {
	expr := node.AsBinaryExpression()
	if expr == nil || expr.OperatorToken == nil {
		return
	}
	if expr.OperatorToken.Kind != shimast.KindPlusToken {
		return
	}
	if isStringLikeLiteral(stripParens(expr.Left)) && isStringLikeLiteral(stripParens(expr.Right)) {
		ctx.Report(node, "Unexpected string concatenation of literals.")
	}
}

func isStringLikeLiteral(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
		return true
	}
	return false
}

// no-octal: `010` octal literal. Has to be opt-in via `0o10` in
// modern code; the legacy form is silently confusing.
// https://eslint.org/docs/latest/rules/no-octal
type noOctal struct{}

func (noOctal) Name() string           { return "no-octal" }
func (noOctal) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindNumericLiteral} }
func (noOctal) Check(ctx *Context, node *shimast.Node) {
	src := nodeText(ctx.File, node)
	src = strings.TrimLeft(src, " \t")
	if len(src) >= 2 && src[0] == '0' && isAsciiDigit(src[1]) {
		ctx.Report(node, "Octal literals should not be used.")
	}
}

func isAsciiDigit(b byte) bool { return b >= '0' && b <= '9' }

func init() {
	Register(noTemplateCurlyInString{})
	Register(noMultiStr{})
	Register(noUselessConcat{})
	Register(noOctal{})
}
