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
