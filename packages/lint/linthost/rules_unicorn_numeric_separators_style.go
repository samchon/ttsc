// unicorn/numeric-separators-style: ES2021 numeric separators (`_`)
// only help readability when the grouping itself is conventional —
// thousands for decimal (`1_000_000`) and four-digit groups for hex /
// binary / octal (`0xFFFF_FFFF`). Off-by-one groupings (`1_2345`) read
// worse than the unseparated form. The rule fires when any literal
// already uses `_` but its groups don't match the canonical pattern.
//
// AST-only: visit `KindNumericLiteral`, read the raw source via
// `nodeText` so the underscores survive parser normalization, pick the
// canonical group size from the prefix (`0x`/`0X` → 4, `0b`/`0B` → 4,
// `0o`/`0O` → 4, anything else → 3), and reject any literal that
// contains an underscore but whose integer portion fails the
// canonical-grouping regex.
//
// Conservative MVP: only the integer portion is checked. Floats and
// scientific notation that contain `_` follow the decimal grouping
// rule applied to the leading integer digits.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/numeric-separators-style.md
package linthost

import (
  "regexp"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

var (
  unicornNumericSeparatorsDecimal = regexp.MustCompile(`^[0-9]{1,3}(_[0-9]{3})*$`)
  unicornNumericSeparatorsRadix4  = regexp.MustCompile(`^[0-9A-Fa-f]{1,4}(_[0-9A-Fa-f]{4})*$`)
)

type unicornNumericSeparatorsStyle struct{}

func (unicornNumericSeparatorsStyle) Name() string { return "unicorn/numeric-separators-style" }
func (unicornNumericSeparatorsStyle) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNumericLiteral, shimast.KindBigIntLiteral}
}
func (unicornNumericSeparatorsStyle) Check(ctx *Context, node *shimast.Node) {
  source := strings.TrimSpace(nodeText(ctx.File, node))
  if source == "" || !strings.Contains(source, "_") {
    return
  }
  // Strip a trailing BigInt `n` so the digit-grouping regex doesn't see it.
  source = strings.TrimSuffix(source, "n")

  // Pick the integer portion and the canonical grouping pattern based
  // on prefix; floats fall through to the decimal rule applied to the
  // leading integer digits before the `.` or `e`/`E`.
  integer := source
  pattern := unicornNumericSeparatorsDecimal
  if len(source) >= 2 && source[0] == '0' {
    switch source[1] {
    case 'x', 'X', 'b', 'B', 'o', 'O':
      integer = source[2:]
      pattern = unicornNumericSeparatorsRadix4
    }
  }
  if pattern == unicornNumericSeparatorsDecimal {
    if dot := strings.IndexAny(integer, ".eE"); dot >= 0 {
      integer = integer[:dot]
    }
  }
  if !strings.Contains(integer, "_") {
    return
  }
  if !pattern.MatchString(integer) {
    ctx.Report(node, "Use canonical separator grouping for numeric literals (3 digits for decimal, 4 for hex).")
  }
}

func init() {
  Register(unicornNumericSeparatorsStyle{})
}
