// unicorn/text-encoding-identifier-case: the IANA text-encoding labels
// `UTF-8`, `utf8`, `ASCII`, etc. all resolve to the same encoding in
// browsers and Node, but the surrounding ecosystem (HTTP headers,
// `TextDecoder`, file APIs) varies on which spelling it echoes back.
// Picking one canonical form per encoding makes string-equality checks
// against those echoes stable. The rule asks every encoding-shaped
// literal to use the canonical lowercase, hyphenated form.
//
// AST-only: visit `StringLiteral` and `NoSubstitutionTemplateLiteral`
// nodes. The literal's lowercased text is matched against the well-known
// encoding identifiers; a mismatch with the canonical form (the same
// identifier already in canonical case) fires the rule.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/text-encoding-identifier-case.md
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornTextEncodingIdentifierCase struct{}

// unicornCanonicalTextEncodings maps the lowercased label to its canonical
// spelling. Authors who already wrote the canonical form pass; anything
// else with the same lowercased label fires.
var unicornCanonicalTextEncodings = map[string]string{
	"utf-8":        "utf-8",
	"utf-16le":     "utf-16le",
	"utf-16be":     "utf-16be",
	"ascii":        "ascii",
	"latin1":       "latin1",
	"iso-8859-1":   "iso-8859-1",
	"windows-1252": "windows-1252",
}

func (unicornTextEncodingIdentifierCase) Name() string {
	return "unicorn/text-encoding-identifier-case"
}
func (unicornTextEncodingIdentifierCase) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral}
}
func (unicornTextEncodingIdentifierCase) Check(ctx *Context, node *shimast.Node) {
	text := stringLiteralText(node)
	if text == "" {
		return
	}
	lower := strings.ToLower(text)
	canonical, ok := unicornCanonicalTextEncodings[lower]
	if !ok {
		// `utf8`/`UTF8` share a canonical form with `utf-8` but lowercase
		// differently — handle the hyphen-stripped aliases explicitly.
		switch lower {
		case "utf8":
			canonical = "utf-8"
		case "utf16le":
			canonical = "utf-16le"
		case "utf16be":
			canonical = "utf-16be"
		default:
			return
		}
	}
	if text == canonical {
		return
	}
	ctx.Report(node, "Use the canonical lowercase form for text-encoding identifiers (e.g. `utf-8`).")
}

func init() {
	Register(unicornTextEncodingIdentifierCase{})
}
