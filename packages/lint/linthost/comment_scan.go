// Shared raw comment-token scan used by every rule or pass that needs the
// exact byte range of each comment in a file (inline-disable directives,
// typescript/ban-ts-comment). Centralizing the loop keeps the template
// rescanning subtlety below in one place.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// forEachCommentToken re-lexes `text` with the raw TypeScript scanner and
// invokes `visit` for every comment token with its kind and byte range.
//
// The raw scanner does not split `KindTemplateExpression` on its own:
// after returning `KindTemplateHead`/`KindTemplateMiddle`, it resumes
// lexing the substitution as ordinary code, and a later `}` is reported
// as `KindCloseBraceToken` instead of re-entering the template body.
// Without intervention the next backtick would open a fresh template
// scan that swallows the rest of the file (including every comment) as
// one runaway unterminated literal. The loop avoids this by calling
// `ReScanTemplateToken` on the matching `}`, tracked with a brace-depth
// stack so comment positions stay aligned with the source bytes past any
// template substitution.
func forEachCommentToken(text string, visit func(kind shimast.Kind, pos, end int)) {
  scanner := shimscanner.NewScanner()
  scanner.SetText(text)
  scanner.SetSkipTrivia(false)

  // templateBraceDepth tracks `{` nesting inside each open template
  // substitution. A zero on top means the next `}` matches the original
  // `${` and must be re-scanned as a template middle/tail token.
  var templateBraceDepth []int

  for {
    kind := scanner.Scan()
    switch kind {
    case shimast.KindEndOfFile:
      return
    case shimast.KindTemplateHead, shimast.KindTemplateMiddle:
      // Entering a `${...}` substitution; account for its closing `}`.
      templateBraceDepth = append(templateBraceDepth, 0)
    case shimast.KindOpenBraceToken:
      if n := len(templateBraceDepth); n > 0 {
        templateBraceDepth[n-1]++
      }
    case shimast.KindCloseBraceToken:
      n := len(templateBraceDepth)
      if n == 0 {
        continue
      }
      if templateBraceDepth[n-1] > 0 {
        templateBraceDepth[n-1]--
        continue
      }
      // Matching `}` for the original `${`. Pop the substitution and
      // rescan as template; a `KindTemplateMiddle` reopens a new
      // substitution, a `KindTemplateTail` closes the template literal.
      templateBraceDepth = templateBraceDepth[:n-1]
      rescanned := scanner.ReScanTemplateToken(false /*isTaggedTemplate*/)
      if rescanned == shimast.KindTemplateMiddle {
        templateBraceDepth = append(templateBraceDepth, 0)
      }
    case shimast.KindSingleLineCommentTrivia, shimast.KindMultiLineCommentTrivia:
      visit(kind, scanner.TokenStart(), scanner.TokenEnd())
    }
  }
}
