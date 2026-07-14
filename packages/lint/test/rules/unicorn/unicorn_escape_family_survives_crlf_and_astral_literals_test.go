package linthost

import "testing"

// TestUnicornEscapeFamilySurvivesCrlfAndAstralLiterals verifies the shared
// raw-source scan behind `unicorn/no-hex-escape` and `unicorn/escape-case`
// stays byte-exact around line breaks and multi-byte text.
//
// Both rules walk the literal's raw bytes rather than its decoded value, so
// the scan has to be UTF-8 safe (a multi-byte sequence carries no ASCII
// bytes, and a reported range is a byte range that must still land on the
// token) and line-ending agnostic (a CRLF template segment is one token
// spanning two lines). A backslash before a line terminator is a line
// continuation, not an escape opener, so the characters behind it are
// literal — the negative twin a parity miscount would report.
//
//  1. Lint CRLF sources whose literals carry astral and CJK characters next
//     to escapes.
//  2. Assert both rules report exactly the offending token ranges.
//  3. Assert a line continuation and an escaped backslash behind multi-byte
//     text keep both rules silent.
func TestUnicornEscapeFamilySurvivesCrlfAndAstralLiterals(t *testing.T) {
  cases := []struct {
    name       string
    source     string
    hexEscape  []string
    escapeCase []string
  }{
    {
      name:       "crlf template segments",
      source:     "const t = `\\xa9${a}\r\nb\\xa9`;\r\n",
      hexEscape:  []string{"`\\xa9${", "}\r\nb\\xa9`"},
      escapeCase: []string{"`\\xa9${", "}\r\nb\\xa9`"},
    },
    {
      name:       "astral character before an escape",
      source:     "const s = \"😀\\xa9\";\r\n",
      hexEscape:  []string{"\"😀\\xa9\""},
      escapeCase: []string{"\"😀\\xa9\""},
    },
    {
      name:       "braced escape for an astral code point",
      source:     "const s = \"\\u{1f600}\";\r\n",
      escapeCase: []string{"\"\\u{1f600}\""},
    },
    {
      name:   "line continuation before hex-looking text",
      source: "const s = \"a\\\r\nxa9\";\r\n",
    },
    {
      name:   "escaped backslash behind multi-byte text",
      source: "const s = \"日本\\\\xa9\";\r\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, test.source, test.hexEscape...)
      assertRuleFindingRanges(t, unicornEscapeCaseRuleName, test.source, test.escapeCase...)
    })
  }
}
