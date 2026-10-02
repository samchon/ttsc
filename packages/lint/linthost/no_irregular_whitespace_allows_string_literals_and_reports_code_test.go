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
//
// @evidence contracts/testing.md#behavioral-verification no-irregular-whitespace must ignore irregular characters inside string literals and must report the same characters in code, comments and templates, including the Latin-1 next-line and Mongolian vowel separator characters.
// @evidence contracts/testing.md#independent-expectations ESLint's default options skip strings only, so the string source is clean and the code, comment and template sources report; the reported range is the byte span of the single character.
// @evidence contracts/testing.md#distinguishing-cases The string source and the code source use the same irregular characters and differ only in position, so a rule that ignored the characters everywhere, or reported them everywhere, fails one side.
// @evidence contracts/testing.md#execution-ownership TestNoIrregularWhitespaceAllowsStringLiteralsAndReportsCode parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoIrregularWhitespaceAllowsStringLiteralsAndReportsCode(t *testing.T) {
  assertRuleSkipsSource(t, "no-irregular-whitespace", "const s = \"a b​c\";\nJSON.stringify(s);\n")
  for _, source := range []string{
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
  }
}
