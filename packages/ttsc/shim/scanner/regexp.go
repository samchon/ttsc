package scanner

import (
  "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/diagnostics"
)

// IsValidRegularExpressionLiteral reports whether text contains one
// grammar-valid ECMAScript regular-expression literal after optional leading
// scanner trivia. It deliberately uses
// typescript-go's own scanner and regexp parser so callers share the compiler's
// handling of escapes, flags, Unicode mode, and Unicode Sets syntax.
//
// Trailing text is rejected, including whitespace after the literal. Scanner
// diagnostics cause a false result rather than escaping.
//
// @evidence contracts/common.md#principled-implementation The initial slash token enters upstream's regexp rescan mode; success requires a regexp token, no scanner diagnostic, and a token end equal to the input byte length, establishing one literal after the scanner's permitted leading trivia.
// @evidence contracts/common.md#clear-and-simple-design A fresh local scanner and diagnostic flag handle one input without shared parser state or an independent regexp grammar.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Slash and slash-equals are the scanner's documented regexp-entry tokens; the diagnostic callback uses supported injection rather than replacing scanner internals.
// @evidence contracts/common.md#meaningful-documentation Native prose states compiler grammar ownership, leading-trivia acceptance, trailing-text rejection and diagnostic-to-false behavior, with a separate acknowledgment section.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsValidRegularExpressionLiteral acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsValidRegularExpressionLiteral performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsValidRegularExpressionLiteral computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsValidRegularExpressionLiteral computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsValidRegularExpressionLiteral(text string) bool {
  scanner := NewScanner()
  valid := true
  scanner.SetOnError(func(_ *diagnostics.Message, _, _ int, _ ...any) {
    valid = false
  })
  scanner.SetText(text)
  token := scanner.Scan()
  if token != ast.KindSlashToken && token != ast.KindSlashEqualsToken {
    return false
  }
  if scanner.ReScanSlashToken(true) != ast.KindRegularExpressionLiteral {
    return false
  }
  return valid && scanner.TokenEnd() == len(text)
}
