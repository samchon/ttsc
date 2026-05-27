// typescript/prefer-string-starts-ends-with: prefer
// `str.startsWith(prefix)` / `str.endsWith(suffix)` over the older
// `indexOf` / `lastIndexOf` / anchored-regex shapes:
//
//   - `str.indexOf(p) === 0`                              → startsWith
//   - `str.indexOf(p, str.length - p.length) !== -1`      → endsWith
//   - `str.lastIndexOf(p) === str.length - p.length`      → endsWith
//   - `/^prefix/.test(str)` (a static-prefix regex)       → startsWith
//   - `/suffix$/.test(str)` (a static-suffix regex)       → endsWith
//
// The dedicated methods state the intent directly and avoid the
// off-by-one arithmetic and regex-anchor pitfalls of the older shapes.
// typescript-eslint:
// https://typescript-eslint.io/rules/prefer-string-starts-ends-with/
//
// Type-aware. Without a Checker the rule cannot prove the receiver of
// `indexOf` / `lastIndexOf` (or the argument of `.test(str)`) is a
// `string`, so Context.Checker == nil short-circuits each Check to a
// no-op the way `no-base-to-string` and `prefer-includes` do. `any` /
// `unknown` / `never` are intentionally NOT treated as matching — they
// leak from generic helpers and would explode the false-positive
// volume on user-defined `indexOf` / `test` methods.
package linthost

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type preferStringStartsEndsWith struct{}

func (preferStringStartsEndsWith) Name() string {
	return "typescript/prefer-string-starts-ends-with"
}
func (preferStringStartsEndsWith) NeedsTypeChecker() bool {
	return true
}
func (preferStringStartsEndsWith) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindBinaryExpression,
		shimast.KindCallExpression,
	}
}
func (preferStringStartsEndsWith) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	switch node.Kind {
	case shimast.KindBinaryExpression:
		bin := node.AsBinaryExpression()
		if bin == nil || bin.OperatorToken == nil {
			return
		}
		if !preferStringStartsEndsWithIsEqualityOp(bin.OperatorToken.Kind) {
			return
		}
		if preferStringStartsEndsWithBinary(ctx, bin.Left, bin.Right) {
			ctx.Report(node, preferStringStartsEndsWithMessage)
			return
		}
		if preferStringStartsEndsWithBinary(ctx, bin.Right, bin.Left) {
			ctx.Report(node, preferStringStartsEndsWithMessage)
		}
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		if call == nil {
			return
		}
		if preferStringStartsEndsWithRegexTest(ctx, call) {
			ctx.Report(node, preferStringStartsEndsWithMessage)
		}
	}
}

const preferStringStartsEndsWithMessage = "Prefer `String#startsWith` / `String#endsWith` over the equivalent `indexOf` / `lastIndexOf` / anchored-regex idioms — clearer and avoids the off-by-one arithmetic."

// preferStringStartsEndsWithIsEqualityOp reports whether `kind` is one
// of the equality tokens the rule cares about. Only `==`, `===`,
// `!=`, `!==` matter: every recognized shape compares two integers
// for equality (or inequality with a sentinel) rather than ordering.
func preferStringStartsEndsWithIsEqualityOp(kind shimast.Kind) bool {
	switch kind {
	case shimast.KindEqualsEqualsToken,
		shimast.KindEqualsEqualsEqualsToken,
		shimast.KindExclamationEqualsToken,
		shimast.KindExclamationEqualsEqualsToken:
		return true
	}
	return false
}

// preferStringStartsEndsWithBinary inspects `call op other` for the
// `indexOf` / `lastIndexOf` shapes. Returns true when the receiver of
// the call is provably string-typed AND the right-hand side matches
// the sentinel of one of the recognized rewrites:
//
//	str.indexOf(p) === 0
//	str.indexOf(p, str.length - p.length) !== -1
//	str.lastIndexOf(p) === str.length - p.length
func preferStringStartsEndsWithBinary(
	ctx *Context,
	callNode, otherNode *shimast.Node,
) bool {
	callNode = stripParens(callNode)
	otherNode = stripParens(otherNode)
	if callNode == nil || otherNode == nil {
		return false
	}
	if callNode.Kind != shimast.KindCallExpression {
		return false
	}
	call := callNode.AsCallExpression()
	if call == nil || call.Expression == nil {
		return false
	}
	receiver, method, ok := promisePropertyAccessParts(call.Expression)
	if !ok {
		return false
	}
	if method != "indexOf" && method != "lastIndexOf" {
		return false
	}
	if receiver == nil {
		return false
	}
	t := ctx.Checker.GetTypeAtLocation(receiver)
	if !preferStringStartsEndsWithIsString(t) {
		return false
	}
	args := call.Arguments
	if args == nil || len(args.Nodes) == 0 {
		return false
	}
	arg := stripParens(args.Nodes[0])
	if arg == nil {
		return false
	}
	receiverText := nodeText(ctx.File, receiver)
	argText := nodeText(ctx.File, arg)
	otherText := nodeText(ctx.File, otherNode)
	if receiverText == "" || argText == "" {
		return false
	}
	switch method {
	case "indexOf":
		// startsWith: `str.indexOf(p) === 0`
		if len(args.Nodes) == 1 {
			return otherText == "0"
		}
		// endsWith via positional indexOf: the second argument must
		// equal `str.length - arg.length`, and the comparison must be
		// against -1 (the sentinel for "not present at that
		// position").
		if len(args.Nodes) != 2 {
			return false
		}
		second := stripParens(args.Nodes[1])
		if !preferStringStartsEndsWithIsLengthMinusLength(ctx, second, receiverText, argText) {
			return false
		}
		return preferStringStartsEndsWithIsMinusOne(otherText)
	case "lastIndexOf":
		// endsWith: `str.lastIndexOf(p) === str.length - p.length`
		if len(args.Nodes) != 1 {
			return false
		}
		return preferStringStartsEndsWithIsLengthMinusLengthText(otherText, receiverText, argText)
	}
	return false
}

// preferStringStartsEndsWithRegexTest reports whether `call` is a
// `/^.../.test(str)` or `/...$/.test(str)` invocation on a regex
// literal whose body is a static prefix or suffix — no metacharacters
// other than the anchor and no flags that change the matching
// semantics. The argument to `.test` must be a `string`-typed value;
// without that the call is not equivalent to a startsWith/endsWith
// rewrite (e.g. coercing a non-string regex argument).
func preferStringStartsEndsWithRegexTest(
	ctx *Context,
	call *shimast.CallExpression,
) bool {
	if call == nil || call.Expression == nil || call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
		return false
	}
	receiver, method, ok := promisePropertyAccessParts(call.Expression)
	if !ok || method != "test" {
		return false
	}
	receiver = stripParens(receiver)
	if receiver == nil || receiver.Kind != shimast.KindRegularExpressionLiteral {
		return false
	}
	raw := nodeText(ctx.File, receiver)
	if !preferStringStartsEndsWithIsAnchoredStaticRegex(raw) {
		return false
	}
	arg := stripParens(call.Arguments.Nodes[0])
	if arg == nil {
		return false
	}
	return preferStringStartsEndsWithIsString(ctx.Checker.GetTypeAtLocation(arg))
}

// preferStringStartsEndsWithIsAnchoredStaticRegex reports whether
// `raw` (the source text of a RegularExpressionLiteral, including the
// surrounding `/`) encodes either `^prefix` or `suffix$` with no
// metacharacters other than the anchor itself, and carries no flags
// that change matching semantics (`i`, `m`, `s`, `u`, `v`). A flag
// like `i` would lower-case both sides, which `startsWith` does not
// do — so the rewrite would change meaning.
func preferStringStartsEndsWithIsAnchoredStaticRegex(raw string) bool {
	if len(raw) < 3 || raw[0] != '/' {
		return false
	}
	closing := strings.LastIndexByte(raw, '/')
	if closing <= 0 {
		return false
	}
	pattern := raw[1:closing]
	flags := raw[closing+1:]
	if pattern == "" {
		return false
	}
	for i := 0; i < len(flags); i++ {
		switch flags[i] {
		case 'g', 'y', 'd':
			// stateful/position flags — fine for `.test` since we
			// only call once
		default:
			return false
		}
	}
	if pattern[0] == '^' {
		return preferStringStartsEndsWithIsStaticString(pattern[1:])
	}
	if pattern[len(pattern)-1] == '$' {
		return preferStringStartsEndsWithIsStaticString(pattern[:len(pattern)-1])
	}
	return false
}

// preferStringStartsEndsWithIsStaticString reports whether `pattern`
// is a regex body made up only of literal characters (and accepted
// escape sequences `\.`, `\\`, etc. that represent a single literal
// character). Any metacharacter — `^`, `$`, `*`, `+`, `?`, `(`, `)`,
// `[`, `]`, `{`, `}`, `|`, `.` — disqualifies the body because the
// startsWith/endsWith rewrite would change matching semantics.
func preferStringStartsEndsWithIsStaticString(pattern string) bool {
	if pattern == "" {
		return false
	}
	for i := 0; i < len(pattern); i++ {
		ch := pattern[i]
		if ch == '\\' {
			// Accept only escapes that name a single literal
			// character (`\.`, `\$`, `\^`, `\/`, `\\`, `\(`, `\)`,
			// `\[`, `\]`, `\{`, `\}`, `\|`, `\+`, `\*`, `\?`).
			// Reject character-class shortcuts (`\d`, `\w`, `\s`)
			// and back-references — those would not survive a
			// rewrite to startsWith/endsWith.
			if i+1 >= len(pattern) {
				return false
			}
			next := pattern[i+1]
			switch next {
			case '.', '$', '^', '/', '\\', '(', ')', '[', ']', '{', '}', '|', '+', '*', '?', '-':
				i++
				continue
			}
			return false
		}
		switch ch {
		case '^', '$', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|', '.':
			return false
		}
	}
	return true
}

// preferStringStartsEndsWithIsLengthMinusLength reports whether
// `node` textually evaluates to `<receiver>.length - <arg>.length`.
// The comparison is text-based (after stripping parens) because the
// rewrite only fires when the call site spelled the offset that way
// — matching the upstream rule's textual shape detector.
func preferStringStartsEndsWithIsLengthMinusLength(
	ctx *Context,
	node *shimast.Node,
	receiverText, argText string,
) bool {
	if node == nil {
		return false
	}
	return preferStringStartsEndsWithIsLengthMinusLengthText(nodeText(ctx.File, node), receiverText, argText)
}

// preferStringStartsEndsWithIsLengthMinusLengthText is the text-level
// half of `preferStringStartsEndsWithIsLengthMinusLength` — split out
// so the `lastIndexOf === str.length - p.length` shape can use the
// same matcher against the binary RHS text.
func preferStringStartsEndsWithIsLengthMinusLengthText(text, receiverText, argText string) bool {
	wanted := receiverText + ".length-" + argText + ".length"
	return preferStringStartsEndsWithStripSpaces(text) == wanted
}

// preferStringStartsEndsWithStripSpaces removes whitespace from `s`.
// Used for the textual equality match — `a.length - b.length` and
// `a.length-b.length` should both match the canonical form.
func preferStringStartsEndsWithStripSpaces(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n' {
			continue
		}
		b.WriteByte(ch)
	}
	return b.String()
}

// preferStringStartsEndsWithIsMinusOne reports whether `text` is the
// numeric literal `-1` (with or without internal whitespace).
func preferStringStartsEndsWithIsMinusOne(text string) bool {
	return preferStringStartsEndsWithStripSpaces(text) == "-1"
}

// preferStringStartsEndsWithIsString reports whether t is provably
// string-like. Mirrors `isStringLikeType` in no-base-to-string but
// rejects `any` / `unknown` / `never` so generic helpers don't fire.
// Union and intersection types must have every constituent string-like.
func preferStringStartsEndsWithIsString(t *shimchecker.Type) bool {
	if t == nil {
		return false
	}
	flags := t.Flags()
	if flags&(shimchecker.TypeFlagsAny|shimchecker.TypeFlagsUnknown|shimchecker.TypeFlagsNever) != 0 {
		return false
	}
	if flags&shimchecker.TypeFlagsStringLike != 0 {
		return true
	}
	if flags&(shimchecker.TypeFlagsUnion|shimchecker.TypeFlagsIntersection) != 0 {
		for _, part := range t.Types() {
			if part == nil {
				continue
			}
			if !preferStringStartsEndsWithIsString(part) {
				return false
			}
		}
		return true
	}
	return false
}

func init() {
	Register(preferStringStartsEndsWith{})
}
