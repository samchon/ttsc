// unicorn/number-literal-case: hex / binary / octal numeric literals
// have a conventional canonical form — the radix prefix is lowercase
// (`0x`, `0b`, `0o`) while hex digits are uppercase (`0xFF`). Mixed-case
// alternatives (`0Xff`, `0xff`, `0xFf`, `0XFF`) read inconsistently and
// the rule normalizes the codebase by reporting every literal that
// isn't already canonical.
//
// AST-only: visit `KindNumericLiteral` and `KindBigIntLiteral`, read
// the raw source text via `nodeText` so the prefix and digit casing
// survive the parser's normalization, and report when the prefix letter
// is uppercase OR any hex digit is lowercase. Decimal literals lack a
// prefix and never fire.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/number-literal-case.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornNumberLiteralCase struct{}

func (unicornNumberLiteralCase) Name() string { return "unicorn/number-literal-case" }
func (unicornNumberLiteralCase) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNumericLiteral, shimast.KindBigIntLiteral}
}
func (unicornNumberLiteralCase) Check(ctx *Context, node *shimast.Node) {
  source := strings.TrimSpace(nodeText(ctx.File, node))
  if len(source) < 2 || source[0] != '0' {
    return
  }
  prefix := source[1]
  switch prefix {
  case 'x', 'X':
    if unicornNumberLiteralCaseHexNeedsFix(source, prefix) {
      ctx.Report(node, "Number literals should use a lowercase prefix and uppercase digits — e.g. `0xFF` instead of `0xff`.")
    }
  case 'b', 'B', 'o', 'O':
    // Binary / octal digits are 0-1 / 0-7; only the prefix letter
    // can be in the wrong case.
    if prefix == 'B' || prefix == 'O' {
      ctx.Report(node, "Number literals should use a lowercase prefix and uppercase digits — e.g. `0xFF` instead of `0xff`.")
    }
  }
}

// unicornNumberLiteralCaseHexNeedsFix reports whether the hex literal's
// raw source text deviates from `0x` + uppercase digits. The trailing
// `n` of a hex bigint literal (`0xFFn`) is allowed.
func unicornNumberLiteralCaseHexNeedsFix(source string, prefix byte) bool {
  if prefix != 'x' {
    return true
  }
  digits := source[2:]
  digits = strings.TrimSuffix(digits, "n")
  for i := 0; i < len(digits); i++ {
    ch := digits[i]
    if ch >= 'a' && ch <= 'f' {
      return true
    }
  }
  return false
}

func init() {
  Register(unicornNumberLiteralCase{})
}
