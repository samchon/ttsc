// unicorn/expiring-todo-comments: a `TODO`/`FIXME`/`XXX` comment with no
// expiration condition is a future-dated lie waiting to bit-rot — the
// upstream rule wants every such marker to carry a bracketed predicate
// like `[2027-01-01]` or `[npm:foo@>=2]` so that the lint will start
// failing once the condition is met.
//
// File-level dispatch: visit `KindSourceFile` once per file, scan the
// raw source with the tsgo scanner so embedded `/* */` and `//` tokens
// inside template substitutions and string literals are not mistaken
// for real comments, strip the comment delimiters via
// `stripCommentDelimiters`, then for each stripped body locate a
// TODO-family marker. Go's RE2 has no negative lookahead, so the
// "no `[` annotation block follows" half of the rule is checked
// separately: after the keyword match offset, scan the rest of the
// comment body for a `[` byte. Missing means the marker has no
// expiration condition; the comment range is reported.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/expiring-todo-comments.md
package linthost

import (
	"regexp"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// unicornExpiringTodoCommentsKeywordPattern matches a TODO-family
// marker that starts at the beginning of the (stripped) comment body
// or after whitespace, and is followed by `:`, whitespace, `(`, or
// end-of-string. The leading anchor avoids matching `todo` inside
// kebab-cased identifiers like `expiring-todo-comments` that other
// in-tree comments (e.g. the harness's own `// expect:` lines)
// inevitably include. Case-insensitive.
var unicornExpiringTodoCommentsKeywordPattern = regexp.MustCompile(`(?i)(?:^|\s)(TODO|FIXME|XXX)(?:[:(\s]|$)`)

type unicornExpiringTodoComments struct{}

func (unicornExpiringTodoComments) Name() string { return "unicorn/expiring-todo-comments" }
func (unicornExpiringTodoComments) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}
func (unicornExpiringTodoComments) Check(ctx *Context, node *shimast.Node) {
	if ctx.File == nil {
		return
	}
	src := ctx.File.Text()
	scanner := shimscanner.NewScanner()
	scanner.SetText(src)
	scanner.SetSkipTrivia(false)
	for {
		kind := scanner.Scan()
		if kind == shimast.KindEndOfFile {
			break
		}
		if kind != shimast.KindSingleLineCommentTrivia && kind != shimast.KindMultiLineCommentTrivia {
			continue
		}
		start := scanner.TokenStart()
		end := scanner.TokenEnd()
		if start < 0 || end > len(src) || end <= start {
			continue
		}
		body := stripCommentDelimiters(src[start:end])
		match := unicornExpiringTodoCommentsKeywordPattern.FindStringIndex(body)
		if match == nil {
			continue
		}
		if strings.Contains(body[match[1]:], "[") {
			continue
		}
		ctx.ReportRange(start, end, "Add an expiration condition to this TODO (e.g., `[2027-01-01]` or `[npm:foo@>=2]`).")
	}
}

func init() {
	Register(unicornExpiringTodoComments{})
}
