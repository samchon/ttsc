package scanner

import (
  "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/diagnostics"
)

// IsValidRegularExpressionLiteral reports whether text contains one regexp
// literal accepted without diagnostics by the pinned compiler's scanner and
// regexp parser, after optional leading scanner trivia. It uses the scanner's
// default latest target and the compiler's escape, flag, Unicode and Unicode
// Sets policies. This is not a runtime regexp-execution check or a complete
// certificate of ECMAScript grammar validity: the compiler can diagnose
// otherwise Annex-B-compatible backreferences as likely mistakes.
//
// Trailing text is rejected, including whitespace after the literal. Scanner
// diagnostics cause a false result rather than escaping.
//
// @evidence contracts/common.md#principled-implementation The initial slash token enters upstream's regexp rescan mode; success requires a regexp token, no scanner diagnostic, and a token end equal to the input byte length, establishing one literal after the scanner's permitted leading trivia.
// @evidence contracts/common.md#clear-and-simple-design A fresh local scanner and diagnostic flag handle one input without shared parser state or an independent regexp grammar.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Slash and slash-equals are the scanner's documented regexp-entry tokens; the diagnostic callback uses supported injection rather than replacing scanner internals.
// @evidence contracts/common.md#meaningful-documentation Native prose states compiler grammar ownership, leading-trivia acceptance, trailing-text rejection and diagnostic-to-false behavior, with a separate acknowledgment section.
// @evidence contracts/performance.md#bound-retention-and-release-resources One local scanner retains the input during the call, and regexp parsing can allocate capture/name/reference maps and lists plus recursive group state. Only a boolean escapes; scanner, callback and parser storage become unreachable after completion. There is no historical cache, handle, input-size cap or adapter-enforced nesting limit.
// @evidence contracts/performance.md#efficient-algorithms One scanner performs leading-trivia admission, delimiter and flag scanning and compiler regexp parsing, then checks token-end equality without an independent grammar implementation. Work grows with text bytes, nested groups, captures and references; invalid named references can also trigger upstream spelling suggestions across capture names even though diagnostics only set a flag here. The adapter does not claim fixed work or an early parser stop after the first diagnostic.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate owns no cross-request producer or validity coordinator; a fresh scanner keeps token state and diagnostic observation local to the supplied text, with no shared mutable parse state.
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
