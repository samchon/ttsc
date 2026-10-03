package linthost

import "testing"

// TestNoIrregularWhitespaceAllowsStringLiteralsAndReportsCode verifies that an
// irregular space is accepted inside a string literal and reported in code.
//
// ESLint's default `skipStrings` lets a string carry a no-break space or a
// zero-width character, because the character is data there. The same character
// between tokens, in a comment or in a template is an invisible copy-paste
// accident and is reported.
//
//  1. Run the rule over a string literal holding a no-break space and a zero-width
//     space and assert nothing is reported.
//  2. Run it over a no-break space between two tokens, inside a line comment and
//     inside a template literal and assert each reports once, at that character.
//  3. Check next-line and Mongolian vowel separators between tokens, including
//     the exact byte range of each authored character.
//
// @evidence contracts/testing.md#behavioral-verification no-irregular-whitespace skips the authored no-break/zero-width spaces in a string, reports no-break spaces in code/comments/templates, and reports next-line/Mongolian vowel separators in code with exact byte ranges.
// @evidence contracts/testing.md#independent-expectations ESLint's default options skip strings only, so the string source is clean and the code, comment and template sources report; the reported range is the byte span of the single character.
// @evidence contracts/testing.md#distinguishing-cases The no-break space is clean in a string and reports in code/comments/templates. The string additionally contains a zero-width space; next-line and Mongolian vowel separators have code-only positive cases. Exact literal ranges distinguish the offending character from another token or a truncated multibyte span.
// @evidence contracts/testing.md#execution-ownership TestNoIrregularWhitespaceAllowsStringLiteralsAndReportsCode parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoIrregularWhitespaceAllowsStringLiteralsAndReportsCode(t *testing.T) {
  assertRuleSkipsSource(t, "no-irregular-whitespace", "const s = \"a b​c\";\nJSON.stringify(s);\n")
  expectedRanges := [][2]int{{5, 7}, {7, 9}, {12, 14}, {5, 7}, {5, 8}}
  for index, source := range []string{
    "const x = 1;\nJSON.stringify(x);\n",
    "// note here\nconst x = 1;\nJSON.stringify(x);\n",
    "const x = `a b`;\nJSON.stringify(x);\n",
    "const\u0085x = 1;\nJSON.stringify(x);\n",
    "const᠎x = 1;\nJSON.stringify(x);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "no-irregular-whitespace", source, nil)
    if len(findings) != 1 {
      t.Fatalf("no-irregular-whitespace on %q: want exactly one finding, got %d", source, len(findings))
    }
    expected := expectedRanges[index]
    if findings[0].Pos != expected[0] || findings[0].End != expected[1] {
      t.Fatalf("no-irregular-whitespace on %q: want range [%d,%d), got [%d,%d)",
        source, expected[0], expected[1], findings[0].Pos, findings[0].End)
    }
  }
}
