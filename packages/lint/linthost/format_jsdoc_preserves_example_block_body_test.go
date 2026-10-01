package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocPreservesExampleBlockBody verifies the rule does not
// rewrite tag synonyms inside an `@example` block.
//
// `@example` is JSDoc's sample-code tag. Its body is
// free-form code that often quotes JSDoc itself, including the
// synonyms (`@arg`, `@return`) the rule normally rewrites. A regression
// that rewrote them inside the example would corrupt the documented
// sample. The rule fast-forwards past the example body to the next
// top-level `@` at line start.
//
//  1. Parse a JSDoc block containing one synonym outside `@example`
//     (must be rewritten) and one synonym inside (must be preserved).
//  2. Run formatJsdoc.
//  3. Require the exact outer-tag edit and complete output preserving the sample.
//  4. Add a synonym after the example and require normalization to resume.
//
// @evidence contracts/testing.md#behavioral-verification The owning JSDoc rule must rewrite only the outer return tag, preserve sample-code tag text, and resume normalization after the example. The original count assertion remains, strengthened by exact sole outer-tag edit and complete source oracles that expose wrong-position or skipped-recovery findings.
// @evidence contracts/testing.md#independent-expectations The supported example-content policy leaves free-form sample bytes intact, while JSDoc recognizes return and arg as aliases of returns and param. Expected changes replace only explicitly named outer block-tag spellings; no expected edit is computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases The original example contains an outer return positive and an inner return negative, followed by a canonical description. An added variant puts arg after the example and requires its param rewrite, distinguishing resumption from skipping the rest of the block.
// @evidence contracts/testing.md#execution-ownership TestFormatJSDocPreservesExampleBlockBody owns every literal/derived source variant, direct parsed-source Engine finding and full edit-output assertion in the public Go unit population. Only the owning rule and in-process edit harness run; there is no consumer install, native build or real product host.
func TestFormatJSDocPreservesExampleBlockBody(t *testing.T) {
  source := "/**\n" +
    " * Outer description.\n" +
    " * @return {number} the outer doc that gets rewritten\n" +
    " * @example\n" +
    " * function demo() {\n" +
    " *   // @return inside example body — should NOT be rewritten\n" +
    " * }\n" +
    " * @description trailing canonical tag closes the example\n" +
    " */\n" +
    "export const value = 1;\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/jsdoc": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected 1 finding (only the outer @return → @returns), got %d:\n%v",
      len(findings), findings)
  }
  finding := findings[0]
  if finding.Rule != "format/jsdoc" || !finding.IsFormat || len(finding.Fix) != 1 {
    t.Fatalf("expected only the outer tag-name edit: %+v", finding)
  }
  edit := finding.Fix[0]
  start := strings.Index(source, "@return") + 1
  if edit.Pos != start || edit.End != start+len("return") || edit.Text != "returns" {
    t.Fatalf("tag edit must exclude example content: %+v", edit)
  }
  assertFixSnapshot(t, "format/jsdoc", source,
    strings.Replace(source, "@return {number}", "@returns {number}", 1))
  following := strings.Replace(source, "@description trailing canonical tag closes the example", "@arg trailing parameter", 1)
  followingWant := strings.Replace(following, "@return {number}", "@returns {number}", 1)
  followingWant = strings.Replace(followingWant, "@arg trailing parameter", "@param trailing parameter", 1)
  assertFixSnapshot(t, "format/jsdoc", following, followingWant)
}
