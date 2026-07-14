package linthost

import "testing"

// TestUnicornStringContentNormalizesTemplateLineEndingsLikeAcorn verifies
// template quasis match and rewrite against LF-normalized raw text.
//
// ESLint never sees a CRLF inside `TemplateElement.value.raw`: acorn
// materializes it with `/\r\n?/g` collapsed to `\n`. Upstream therefore
// matches multi-line patterns against the normalized text, and a reported
// quasi is rewritten from it, so a fixed CRLF template comes back LF-only
// while untouched templates keep their original bytes. Matching on the raw
// source slice instead would miss `no\nno` across a CRLF boundary.
//
//  1. Fix CRLF and lone-CR templates under single-line and cross-newline
//     patterns and compare the LF-normalized outputs byte-for-byte.
//  2. Assert line terminators outside the quasi (and non-matching CRLF
//     templates) keep their original bytes.
//  3. Assert each fixed source stays parse-valid and no longer fires.
func TestUnicornStringContentNormalizesTemplateLineEndingsLikeAcorn(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    options  string
    expected string
  }{
    {
      name: "matching CRLF quasi is rewritten LF-only",
      // The trailing statement CRLF sits outside the template and must
      // survive; the quasi's inner CRLF is upstream's LF after the fix.
      source:   "const a = `no\r\nno`;\r\n",
      options:  `{"patterns":{"no":"yes"}}`,
      expected: "const a = `yes\nyes`;\r\n",
    },
    {
      name:     "cross-newline pattern matches through a CRLF boundary",
      source:   "const a = `no\r\nno`;\r\n",
      options:  `{"patterns":{"no\\nno":"yes"}}`,
      expected: "const a = `yes`;\r\n",
    },
    {
      name:     "lone carriage return normalizes to LF",
      source:   "const a = `no\rno`;\n",
      options:  `{"patterns":{"no\\nno":"yes"}}`,
      expected: "const a = `yes`;\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "unicorn/string-content", test.source, test.options, test.expected)
      file := parseTSFile(t, "/virtual/fixed-string-content-line-endings.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", test.expected, test.options)
    })
  }

  // A CRLF template that matches nothing must keep its original bytes: the
  // normalization is a matching model, not a whole-file rewrite.
  assertRuleSkipsSourceWithOptions(
    t,
    "unicorn/string-content",
    "const a = `keep\r\nkeep`;\r\n",
    `{"patterns":{"zz":"yy"}}`,
  )
}
