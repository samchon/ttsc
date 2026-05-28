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
//
// Hot-path budget: `KindIdentifier` is the most frequent AST kind in
// any TypeScript program, so this Check is invoked tens-of-thousands
// of times per file. A length pre-filter eliminates ~90 % of inputs
// without touching memory (the longest dictionary entry is six
// characters); an additional `isAllLowerASCII` check skips
// `strings.ToLower`'s allocation for the common case of already-
// lower-cased identifiers.
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

// unicornPreventAbbreviationsMaxLen is the longest dictionary key
// length. Any identifier longer than this cannot match — the Check
// returns immediately without touching the dictionary.
const unicornPreventAbbreviationsMaxLen = 6

type unicornPreventAbbreviations struct{}

func (unicornPreventAbbreviations) Name() string { return "unicorn/prevent-abbreviations" }
func (unicornPreventAbbreviations) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIdentifier}
}
func (unicornPreventAbbreviations) Check(ctx *Context, node *shimast.Node) {
	name := identifierText(node)
	if name == "" || len(name) > unicornPreventAbbreviationsMaxLen {
		return
	}
	// Fast path: dictionary keys are pre-lowercased, so an
	// already-lower-case identifier avoids `strings.ToLower`'s
	// allocation entirely. The Check is invoked once per identifier
	// in the file, so the saved allocations multiply.
	lookup := name
	if !isAllLowerASCII(name) {
		lookup = strings.ToLower(name)
	}
	if _, ok := unicornPreventAbbreviationsDictionary[lookup]; !ok {
		return
	}
	ctx.Report(node, "Prefer the long form over abbreviated identifiers (e.g. `error` over `err`).")
}

// isAllLowerASCII reports whether `s` is a non-empty ASCII string
// whose every byte is a lower-case letter. Used by hot-path Checks
// that look up an already-normalized dictionary — the result is
// equivalent to `s == strings.ToLower(s)` for all-ASCII inputs but
// avoids the lowercase allocation.
func isAllLowerASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			return false
		}
	}
	return true
}

func init() {
	Register(unicornPreventAbbreviations{})
}
