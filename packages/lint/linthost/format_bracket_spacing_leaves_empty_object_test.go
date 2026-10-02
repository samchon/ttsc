package linthost

import "testing"

// TestFormatBracketSpacingLeavesEmptyObject verifies empty-object boundaries
// across both spacing modes. Whitespace-only single-line interiors collapse
// to {}, but multiline interiors and comments retain their content.
//
// @evidence contracts/testing.md#behavioral-verification format/bracket-spacing must keep exactly empty objects unchanged and collapse single-line ECMAScript horizontal-trivia-only interiors under both spacing options without deleting comments or multiline content; the direct trimming helper must retain NEL, zero-width space and Mongolian vowel separator payload bytes.
// @evidence contracts/testing.md#independent-expectations Literal outputs follow the supported empty-object and brace-padding policies and installed Prettier 3.8.3 whitespace-only output. ECMAScript WhiteSpace admits Zs, tab, VT, FF and BOM, and excludes NEL, zero-width space and Mongolian vowel separator; direct helper outputs retain those excluded bytes. Comment-bearing outputs retain the comment bytes, while multiline fixtures require no findings because indentation is outside this rule. U+2028 and U+2029 are ECMAScript line terminators, so this single-line rule must abstain even though a complete Prettier pass normalizes empty multiline objects.
// @evidence contracts/testing.md#distinguishing-cases The original true/false {} negatives remain. Space/tab/mixed interiors and every current Unicode Zs character, VT, FF and BOM are positives under both options; LF/CRLF and bare or space-padded U+2028/U+2029 multiline interiors are negatives and comment-bearing interiors preserve meaning while adding or removing only padding.
// @evidence contracts/testing.md#execution-ownership TestFormatBracketSpacingLeavesEmptyObject is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns every literal option/input/output and the original no-finding assertions, including every named Unicode boundary subtest; the direct trimBracketSpacingWhitespace calls retain excluded bytes, and the shared syntax-only harness runs the owning rule and applies edits in process without a consumer install, native product build or product host.
func TestFormatBracketSpacingLeavesEmptyObject(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/bracket-spacing",
    "const b = {};\n",
    `{"spacing":true}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/bracket-spacing", "const b = {};\n", `{"spacing":false}`)
  for _, options := range []string{`{"spacing":true}`, `{"spacing":false}`} {
    for _, source := range []string{"const b = {   };\n", "const b = {\t};\n", "const b = { \t };\n"} {
      assertFixSnapshotWithOptions(t, "format/bracket-spacing", source, options, "const b = {};\n")
    }
    assertRuleSkipsSourceWithOptions(t, "format/bracket-spacing", "const b = {\n};\n", options)
    assertRuleSkipsSourceWithOptions(t, "format/bracket-spacing", "const b = {\r\n};\r\n", options)
  }
  assertFixSnapshotWithOptions(t, "format/bracket-spacing", "const b = {/*keep*/};\n", `{"spacing":true}`, "const b = { /*keep*/ };\n")
  assertFixSnapshotWithOptions(t, "format/bracket-spacing", "const b = { /*keep*/ };\n", `{"spacing":false}`, "const b = {/*keep*/};\n")
  for _, boundary := range []struct {
    name string
    source string
    collapse bool
  }{
    {"nbsp", "const b = {\u00a0};\n", true},
    {"bom", "const b = {\ufeff};\n", true},
    {"vertical_tab", "const b = {\v};\n", true},
    {"form_feed", "const b = {\f};\n", true},
    {"ogham", "const b = {\u1680};\n", true},
    {"en_quad", "const b = {\u2000};\n", true},
    {"em_quad", "const b = {\u2001};\n", true},
    {"en_space", "const b = {\u2002};\n", true},
    {"em_space", "const b = {\u2003};\n", true},
    {"three_per_em", "const b = {\u2004};\n", true},
    {"four_per_em", "const b = {\u2005};\n", true},
    {"six_per_em", "const b = {\u2006};\n", true},
    {"figure_space", "const b = {\u2007};\n", true},
    {"punctuation_space", "const b = {\u2008};\n", true},
    {"thin_space", "const b = {\u2009};\n", true},
    {"hair_space", "const b = {\u200a};\n", true},
    {"narrow_nbsp", "const b = {\u202f};\n", true},
    {"medium_mathematical_space", "const b = {\u205f};\n", true},
    {"ideographic_space", "const b = {\u3000};\n", true},
    {"line_separator", "const b = {\u2028};\n", false},
    {"paragraph_separator", "const b = {\u2029};\n", false},
    {"line_separator_padded", "const b = { \u2028 };\n", false},
    {"paragraph_separator_padded", "const b = { \u2029 };\n", false},
  } {
    for _, options := range []string{`{"spacing":true}`, `{"spacing":false}`} {
      t.Run(boundary.name+"_"+options, func(t *testing.T) {
        if boundary.collapse {
          assertFixSnapshotWithOptions(t, "format/bracket-spacing", boundary.source, options, "const b = {};\n")
        } else {
          assertRuleSkipsSourceWithOptions(t, "format/bracket-spacing", boundary.source, options)
        }
      })
    }
  }
  for _, excluded := range []string{"\u0085", "\u200b", "\u180e"} {
    if got := trimBracketSpacingWhitespace(" "+excluded+"payload"+excluded+" "); got != excluded+"payload"+excluded {
      t.Fatalf("must retain non-ECMAScript whitespace %q: got %q", excluded, got)
    }
  }
}
