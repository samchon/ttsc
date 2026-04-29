package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-eval: forbid `eval(...)` calls. Members of nested namespaces (e.g.
// `globalThis.eval(...)`) are not flagged here — that's
// `no-implied-eval`, which we don't ship in v0.
// https://eslint.org/docs/latest/rules/no-eval
type noEval struct{}

func (noEval) Name() string           { return "no-eval" }
func (noEval) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCallExpression} }
func (noEval) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil {
		return
	}
	if callCalleeName(call) == "eval" {
		ctx.Report(node, "eval can be harmful.")
	}
}

// no-script-url: forbid `"javascript:..."` literals. Often used to inject
// inline JS via DOM `href`/`src`; legacy and dangerous.
// https://eslint.org/docs/latest/rules/no-script-url
type noScriptURL struct{}

func (noScriptURL) Name() string { return "no-script-url" }
func (noScriptURL) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral}
}
func (noScriptURL) Check(ctx *Context, node *shimast.Node) {
	text := stringLiteralText(node)
	if isJavaScriptURL(text) {
		ctx.Report(node, "Script URL is a form of eval.")
	}
}

func isJavaScriptURL(text string) bool {
	const prefix = "javascript:"
	if len(text) < len(prefix) {
		return false
	}
	for i := 0; i < len(prefix); i++ {
		c := text[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		if c != prefix[i] {
			return false
		}
	}
	return true
}

func init() {
	Register(noEval{})
	Register(noScriptURL{})
}
