package linthost

import "testing"

// TestUnicornStringContentEscapesDelimiterQuotesInLiteralFix verifies the
// literal fixer escapes the delimiter quote and preserves backslashes.
//
// The fix replaces the whole literal with the replaced COOKED value passed
// through quote-js-string, so a replacement containing the delimiter quote
// must gain a backslash while the other quote stays raw, and cooked
// backslashes must come back doubled. These are the four quote-escape cases
// from the upstream suite; getting any wrong produces unparsable output.
//
//  1. Configure `{quote: "'\""}` (a replacement containing both quotes).
//  2. Fix single- and double-quoted literals, with and without surrounding
//     `\\` escapes.
//  3. Compare each rewritten source byte-for-byte with the upstream oracle.
//
// @evidence contracts/testing.md#behavioral-verification Exact fix snapshots and parser diagnostics distinguish quote/backslash corruption in single- and double-quoted string replacements.
// @evidence contracts/testing.md#independent-expectations Official Unicorn quote-escape examples establish the four literal expected sources; delimiter grammar explains why only the owning quote is escaped.
// @evidence contracts/testing.md#distinguishing-cases Both delimiter choices execute with and without surrounding backslashes. Plain matching and canonical nonmatching controls belong to ReportsAndFixesPlainStringLiteral.
// @evidence contracts/testing.md#execution-ownership TestUnicornStringContentEscapesDelimiterQuotesInLiteralFix is the owning discoverable Go unit entry; its explicit variants and named t.Run cases preserve failure identity while engine, parser and fix operations share one Go process. Fixture files use t.TempDir; no installed consumer, native build or product child host runs.
func TestUnicornStringContentEscapesDelimiterQuotesInLiteralFix(t *testing.T) {
  options := `{"patterns":{"quote":{"suggest":"'\""}}}`
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "single quoted",
      source:   `const foo = 'quote';` + "\n",
      expected: `const foo = '\'"';` + "\n",
    },
    {
      name:     "single quoted with backslashes",
      source:   `const foo = '\\quote\\';` + "\n",
      expected: `const foo = '\\\'"\\';` + "\n",
    },
    {
      name:     "double quoted",
      source:   `const foo = "quote";` + "\n",
      expected: `const foo = "'\"";` + "\n",
    },
    {
      name:     "double quoted with backslashes",
      source:   `const foo = "\\quote\\";` + "\n",
      expected: `const foo = "\\'\"\\";` + "\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "unicorn/string-content", test.source, options, test.expected)
      file := parseTSFile(t, "/virtual/fixed-string-content-quotes.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
    })
  }
}
