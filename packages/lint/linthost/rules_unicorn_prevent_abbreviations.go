// unicorn/prevent-abbreviations: abbreviated identifier names (`err`,
// `cb`, `ctx`, `idx`) are a project-wide readability tax — every
// reader has to expand the shorthand mentally on the spot. The
// upstream rule maintains a large allowlist + replacements map; this
// MVP carries the most universal abbreviations only and fires on any
// identifier whose lower-cased text matches one of them, in both
// reference and declaration positions, so a `param` parameter and a
// `void param` read are both reported.
//
// AST-only: visit every `Identifier`, lowercase the lexeme, look it up
// in `unicornPreventAbbreviationsDictionary`. No scope analysis is
// performed because the rule's diagnostic is about the *name*, not the
// binding — every occurrence of `idx` is equally noisy.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prevent-abbreviations.md
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// unicornPreventAbbreviationsDictionary is the MVP allowlist of
// abbreviations that fire the rule. Lower-cased keys; the rule
// case-folds the identifier before lookup. Intentionally conservative
// — picks the abbreviations universally agreed across upstream
// presets so the rule doesn't flap on neutral words.
var unicornPreventAbbreviationsDictionary = map[string]struct{}{
	"arr":    {},
	"args":   {},
	"attr":   {},
	"btn":    {},
	"cb":     {},
	"cmd":    {},
	"ctx":    {},
	"db":     {},
	"dest":   {},
	"dir":    {},
	"doc":    {},
	"el":     {},
	"elem":   {},
	"env":    {},
	"err":    {},
	"evt":    {},
	"fn":     {},
	"func":   {},
	"idx":    {},
	"len":    {},
	"lib":    {},
	"mgr":    {},
	"mod":    {},
	"msg":    {},
	"num":    {},
	"obj":    {},
	"opts":   {},
	"param":  {},
	"params": {},
	"pkg":    {},
	"prev":   {},
	"prop":   {},
	"props":  {},
	"ref":    {},
	"res":    {},
	"ret":    {},
	"src":    {},
	"str":    {},
	"tmp":    {},
	"val":    {},
	"var":    {},
}

type unicornPreventAbbreviations struct{}

func (unicornPreventAbbreviations) Name() string { return "unicorn/prevent-abbreviations" }
func (unicornPreventAbbreviations) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIdentifier}
}
func (unicornPreventAbbreviations) Check(ctx *Context, node *shimast.Node) {
	name := identifierText(node)
	if name == "" {
		return
	}
	if _, ok := unicornPreventAbbreviationsDictionary[strings.ToLower(name)]; !ok {
		return
	}
	ctx.Report(node, "Prefer the long form over abbreviated identifiers (e.g. `error` over `err`).")
}

func init() {
	Register(unicornPreventAbbreviations{})
}
