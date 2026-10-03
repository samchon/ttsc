package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocSkipsJSDocLikeStringsInSource verifies the rule does
// not rewrite tag synonyms inside string literals that happen to contain
// a JSDoc-shaped substring.
//
// A naive byte-scan for `/**` would treat `const s = "/** @return */"`
// as a JSDoc block and rewrite the embedded `@return`, corrupting the
// user's runtime string data. The rule now drives off the tsgo
// scanner's `MultiLineCommentTrivia` ranges so only real comments are
// processed.
//
//  1. Parse ordinary string and template payloads with JSDoc-like text.
//  2. Run formatJsdoc.
//  3. Assert zero findings, then add a real comment and require only its
//     tag spelling to change while both runtime payloads stay intact.
//
// @evidence contracts/testing.md#behavioral-verification The owning JSDoc rule must leave JSDoc-shaped substrings inside both an ordinary string and a template untouched while changing a neighboring real comment. The original no-finding assertion remains, and paired full output catches both corrupting runtime payload and skipping real comments.
// @evidence contracts/testing.md#independent-expectations String and template contents are runtime data rather than comment tokens. The literal source suffix is retained byte for byte, while the supported return-to-returns alias independently supplies the real-comment replacement.
// @evidence contracts/testing.md#distinguishing-cases The original two lexical payload negatives remain and the same source with a real return block adds an adjacent positive. PreservesExampleBlockBody covers tag-looking content inside a real documentation comment.
// @evidence contracts/testing.md#execution-ownership TestFormatJSDocSkipsJSDocLikeStringsInSource owns the parsed lexical fixtures, direct Engine assertion and complete paired output in the public Go unit population. The owning rule and in-process edit harness use no consumer install, native build or real product host.
func TestFormatJSDocSkipsJSDocLikeStringsInSource(t *testing.T) {
  source := "export const s = \"/** @return number */\";\n" +
    "export const t = `/** @arg x */`;\n" +
    "console.log(s, t);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/jsdoc": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings (no real JSDoc in source), got %d:\n%v",
      len(findings), findings)
  }
  assertFixSnapshot(t, "format/jsdoc", "/** @return number */\n"+source,
    "/** @returns number */\n"+source)
}
