// unicorn/prefer-string-replace-all: `"abc".replace(/a/g, "x")` is the
// pre-ES2021 idiom for "replace every occurrence". ES2021's
// `String#replaceAll` does the same thing without the regex flag
// detour. The rule fires on `.replace(/<pattern>/g, replacement)` so
// authors switch to the explicit method.
//
// AST-only: a `CallExpression` whose callee is `.replace` AND whose
// first argument is a `RegularExpressionLiteral` carrying the `g` flag
// in its trailing flag block matches. The flag is read from the raw
// source text — the AST does not split pattern from flags — using the
// shared `nodeText` accessor.
//
// To preserve semantics, the pattern body must also be literal — any
// regex metacharacter (`\`, `.`, `*`, `+`, `?`, `[`, `]`, `(`, `)`,
// `{`, `}`, `|`, `^`, `$`) disqualifies the rewrite, because
// `/<pat>/g` and `.replaceAll(<pat>, ...)` mean different things when
// the pattern is anything but a fixed string.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-replace-all.md
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornPreferStringReplaceAll struct{}

func (unicornPreferStringReplaceAll) Name() string { return "unicorn/prefer-string-replace-all" }
func (unicornPreferStringReplaceAll) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferStringReplaceAll) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil ||
		call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil || identifierText(access.Name()) != "replace" {
		return
	}
	if call.Arguments == nil || len(call.Arguments.Nodes) < 1 {
		return
	}
	first := stripParens(call.Arguments.Nodes[0])
	if first == nil || first.Kind != shimast.KindRegularExpressionLiteral {
		return
	}
	raw := nodeText(ctx.File, first)
	if !unicornPreferStringReplaceAllHasGlobalFlag(raw) {
		return
	}
	if !unicornPreferStringReplaceAllIsLiteralPattern(raw) {
		return
	}
	ctx.Report(node, "Prefer `String#replaceAll(literal, replacement)` over `replace(/literal/g, replacement)`.")
}

// unicornPreferStringReplaceAllHasGlobalFlag returns true when `raw` (the
// source text of a RegularExpressionLiteral, including the surrounding
// `/` delimiters and trailing flag block) carries the `g` flag.
func unicornPreferStringReplaceAllHasGlobalFlag(raw string) bool {
	if len(raw) < 3 || raw[0] != '/' {
		return false
	}
	closing := strings.LastIndexByte(raw, '/')
	if closing <= 0 {
		return false
	}
	flags := raw[closing+1:]
	return strings.ContainsRune(flags, 'g')
}

// unicornPreferStringReplaceAllIsLiteralPattern returns true when the
// pattern body of `raw` (the source text of a RegularExpressionLiteral)
// contains no regex metacharacters. Conservative: any metachar — even
// an escaped one like `\.` — disqualifies the rewrite, because
// recovering the original character cleanly from raw source requires
// regex-aware parsing we don't do here.
func unicornPreferStringReplaceAllIsLiteralPattern(raw string) bool {
	if len(raw) < 3 || raw[0] != '/' {
		return false
	}
	closing := strings.LastIndexByte(raw, '/')
	if closing <= 0 {
		return false
	}
	body := raw[1:closing]
	return !strings.ContainsAny(body, `\.*+?[](){}|^$`)
}

func init() {
	Register(unicornPreferStringReplaceAll{})
}
