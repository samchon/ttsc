// unicorn/number-literal-case: numeric and BigInt literals have a
// conventional canonical spelling — every letter that carries no value is
// lowercase (the radix prefix `0x` / `0b` / `0o`, the exponent `e`, the
// BigInt suffix `n`) except the hex digits, which are uppercase (`0xFF`).
// Mixed-case alternatives (`0Xff`, `0xfF`, `1E10`, `2E-5`) read
// inconsistently, so the rule reports every literal whose raw source text
// differs from that spelling and autofixes it in place.
//
// AST-only: visit `KindNumericLiteral` and `KindBigIntLiteral`, read the
// raw source text (the parser's normalized `.Text` has already dropped the
// casing), and compare it against the spelling upstream's fixer produces —
// lowercase the whole literal, then uppercase whatever follows a `0x`
// prefix. The BigInt `n` is held out of that pass, which is what stops
// `0xFFn` from becoming `0xFFN`. Uppercasing the hex digits *after* the
// lowercase pass is also what keeps `E` correct in both worlds: inside a
// hex literal `E` is a digit and stays uppercase (`0xFFE10`), and a hex
// literal has no exponent, while a decimal literal has no letter other
// than its exponent `e`.
//
// Only letter case changes — digits, `.`, `_`, and the exponent sign are
// copied through — so the fix never alters the literal's value.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/number-literal-case.md
package linthost

import (
  "fmt"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type unicornNumberLiteralCase struct{}

func (unicornNumberLiteralCase) Name() string { return "unicorn/number-literal-case" }
func (unicornNumberLiteralCase) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNumericLiteral, shimast.KindBigIntLiteral}
}
func (unicornNumberLiteralCase) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  source := ctx.File.Text()
  start := shimscanner.SkipTrivia(source, node.Pos())
  end := node.End()
  if start < 0 || end > len(source) || start >= end {
    return
  }
  original := source[start:end]
  canonical := unicornNumberLiteralCaseCanonical(original)
  if canonical == original {
    return
  }
  ctx.ReportFix(
    node,
    fmt.Sprintf("Number literal `%s` should be written as `%s`.", original, canonical),
    TextEdit{Pos: start, End: end, Text: canonical},
  )
}

// unicornNumberLiteralCaseCanonical returns the canonical spelling of one
// literal's raw source text. A BigInt literal is canonicalized by its
// number part alone so the mandatory lowercase `n` suffix survives the hex
// digits' uppercase pass.
func unicornNumberLiteralCaseCanonical(source string) string {
  if strings.HasSuffix(source, "n") {
    return unicornNumberLiteralCaseCanonicalNumber(strings.TrimSuffix(source, "n")) + "n"
  }
  return unicornNumberLiteralCaseCanonicalNumber(source)
}

// unicornNumberLiteralCaseCanonicalNumber canonicalizes a literal's number
// part: everything lowercases (radix prefix, exponent), then a hex
// literal's digits are uppercased. Decimal, binary, octal, and legacy octal
// literals hold no case-bearing digit, so the lowercase pass is all they
// need.
func unicornNumberLiteralCaseCanonicalNumber(number string) string {
  lowered := strings.ToLower(number)
  if strings.HasPrefix(lowered, "0x") {
    return "0x" + strings.ToUpper(lowered[2:])
  }
  return lowered
}

func init() {
  Register(unicornNumberLiteralCase{})
}
