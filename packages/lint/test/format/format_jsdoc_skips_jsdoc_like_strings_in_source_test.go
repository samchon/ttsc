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
//  1. Parse a source where the only `/**` byte sequence lives inside a
//     string literal.
//  2. Run formatJsdoc.
//  3. Assert zero findings — the rule must not touch user data.
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
}
