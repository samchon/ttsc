// unicorn/no-zero-fractions: numeric literals such as `1.0`, `1.`, and
// `.0` carry a redundant fractional component or a trailing dot whose
// only visual effect is to mislead the reader into thinking the value
// needs floating-point semantics. The rule rewrites the source pattern
// out by reporting on the literal node.
//
// AST-only: visit `KindNumericLiteral`, read the raw source text via
// `nodeText` so the parser-normalized `.Text` (which drops the trailing
// dot and zero-pad) doesn't mask the smell, and match three regular
// expressions covering the canonical shapes:
//
//   - `1.0`, `1.00`, `-1.0e5` — fractional part is all zeros.
//   - `1.` — trailing dot with no fractional digits.
//   - `.0`, `-.0e3` — leading dot with an all-zero fractional part.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-zero-fractions.md
package linthost

import (
	"regexp"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

var (
	unicornNoZeroFractionsTrailingZero = regexp.MustCompile(`^-?\d+\.0+([eE][+-]?\d+)?$`)
	unicornNoZeroFractionsTrailingDot  = regexp.MustCompile(`^-?\d+\.$`)
	unicornNoZeroFractionsLeadingDot   = regexp.MustCompile(`^-?\.0+([eE][+-]?\d+)?$`)
)

type unicornNoZeroFractions struct{}

func (unicornNoZeroFractions) Name() string { return "unicorn/no-zero-fractions" }
func (unicornNoZeroFractions) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindNumericLiteral}
}
func (unicornNoZeroFractions) Check(ctx *Context, node *shimast.Node) {
	source := strings.TrimSpace(nodeText(ctx.File, node))
	if source == "" {
		return
	}
	if unicornNoZeroFractionsTrailingZero.MatchString(source) ||
		unicornNoZeroFractionsTrailingDot.MatchString(source) ||
		unicornNoZeroFractionsLeadingDot.MatchString(source) {
		ctx.Report(node, "Don't use a redundant `.0` fraction or trailing dot on a number literal.")
	}
}

func init() {
	Register(unicornNoZeroFractions{})
}
