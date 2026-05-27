// unicorn/escape-case: numeric escape sequences inside string and
// template literals (`\xHH`, `\uHHHH`, `\u{HEX...}`) are case-insensitive
// to the engine but read inconsistently across a codebase when authors
// mix `\xa9` and `\xA9`. Canonical form uses uppercase hex digits; the
// rule fires when any hex escape's A-F digits are lowercase.
//
// AST-only: visit `KindStringLiteral` and `KindNoSubstitutionTemplateLiteral`,
// read the raw source text via `nodeText` (the parser already decodes
// escapes into the `.Text` value), and match against a regex that finds
// `\xHH`, `\uHHHH`, or `\u{HEX...}` whose hex portion contains an a-f
// letter. The match is hex-only — `\n` and other identifier escapes are
// untouched.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/escape-case.md
package linthost

import (
	"regexp"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// unicornEscapeCasePattern matches a hex escape whose hex digits contain
// at least one lowercase a-f letter. The regex anchors on `\x`, `\u`, or
// `\u{...}` and rejects matches where every hex digit is already
// uppercase / 0-9.
var unicornEscapeCasePattern = regexp.MustCompile(
	`\\x[0-9A-Fa-f]*[a-f][0-9A-Fa-f]*|` +
		`\\u\{[0-9A-Fa-f]*[a-f][0-9A-Fa-f]*\}|` +
		`\\u[0-9A-Fa-f]*[a-f][0-9A-Fa-f]*`,
)

type unicornEscapeCase struct{}

func (unicornEscapeCase) Name() string { return "unicorn/escape-case" }
func (unicornEscapeCase) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral}
}
func (unicornEscapeCase) Check(ctx *Context, node *shimast.Node) {
	source := nodeText(ctx.File, node)
	if source == "" {
		return
	}
	if unicornEscapeCasePattern.MatchString(source) {
		ctx.Report(node, "Use uppercase letters for escape sequence hex digits (`\\xA9` over `\\xa9`).")
	}
}

func init() {
	Register(unicornEscapeCase{})
}
