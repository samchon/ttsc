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
// spanning two lines). A backslash before a line terminator opens a line
// continuation: the CR is the escaped character, so the text behind it is
// literal and a scan that stepped over the line break to find its escape
// would report the `xa9` that follows.
//
//  1. Lint CRLF sources whose literals carry astral and CJK characters next
//     to escapes.
//  2. Assert both rules report exactly the offending token ranges.
//  3. Assert a line continuation and an escaped backslash behind multi-byte
//     text keep both rules silent.
//
// @evidence contracts/testing.md#behavioral-verification Both actual rules run through exact-range assertions, detecting byte offsets broken by CRLF or multibyte prefixes.
// @evidence contracts/testing.md#independent-expectations JavaScript escape grammar, UTF-8 source byte positions and the separate hex-versus-uppercase policies determine authored markers.
// @evidence contracts/testing.md#distinguishing-cases CRLF template segments and astral/CJK neighbors retain token boundaries; braced lowercase escapes concern only escape-case, while line continuations and escaped slashes stay clean for both.
// @evidence contracts/testing.md#execution-ownership TestUnicornEscapeFamilySurvivesCrlfAndAstralLiterals owns the explicit source matrix and any named t.Run variants as one discoverable Go unit entry. Parsing and actual engine calls share the Go test process; no installed consumer, native compilation or child product host is needed.
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
