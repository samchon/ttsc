package linthost

import "testing"

// TestUnicornNoHexEscapeIgnoresNonHexEscapes verifies only the `\xHH` form
// reports.
//
// The rule reports a preference for Unicode escapes without rewriting.
// Fixed-width and braced Unicode escapes are negative twins that distinguish
// the active hex-escape scan from other escape forms.
// A scan that looked for the letter `x` alone would report plain text like
// `x41`, and one that ignored the digit width would swallow the literal
// characters behind an escape; `"\x41bcd"` is the positive twin of the
// `escape-case` boundary case, because the escape ends after two hex digits
// yet is still a hex escape and must report.
//
//  1. Lint Unicode escapes, a non-numeric escape, a decoded glyph, and plain
//     hex-looking text.
//  2. Assert none of them report.
//  3. Assert genuine `\xHH` escapes — including one trailed by literal hex
//     letters and one behind a multi-byte character — report at their exact
//     byte range.
//
// @evidence contracts/testing.md#behavioral-verification Exact range and zero-finding assertions distinguish genuine xHH escapes from Unicode forms or hex-looking ordinary text.
// @evidence contracts/testing.md#independent-expectations JavaScript hex-versus-Unicode escape grammar and the supported Unicode-preference policy establish independent literal markers.
// @evidence contracts/testing.md#distinguishing-cases Fixed/braced Unicode, decoded glyphs, named escapes and plain x41 remain clean; genuine hex escapes still report behind literal hex letters or multibyte text.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoHexEscapeIgnoresNonHexEscapes owns the explicit source matrix and any named t.Run variants as one discoverable Go unit entry. Parsing and actual engine calls share the Go test process; no installed consumer, native compilation or child product host is needed.
func TestUnicornNoHexEscapeIgnoresNonHexEscapes(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    markers []string
  }{
    {
      name:   "fixed-width unicode escape",
      source: "const s = \"\\u00A9\";\n",
    },
    {
      name:   "braced code point escape",
      source: "const s = \"\\u{1F600}\";\n",
    },
    {
      name:   "decoded glyph",
      source: "const s = \"©\";\n",
    },
    {
      name:   "non-numeric escapes",
      source: "const s = \"\\n\\t\";\n",
    },
    {
      name:   "plain hex-looking text",
      source: "const s = \"x41\";\n",
    },
    {
      name:    "hex escape",
      source:  "const s = \"\\xA9\";\n",
      markers: []string{"\"\\xA9\""},
    },
    {
      name:    "hex escape trailed by literal hex letters",
      source:  "const s = \"\\x41bcd\";\n",
      markers: []string{"\"\\x41bcd\""},
    },
    {
      name:    "hex escape behind a multi-byte character",
      source:  "const s = \"日本\\xA9\";\n",
      markers: []string{"\"日本\\xA9\""},
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, test.source, test.markers...)
    })
  }
}
