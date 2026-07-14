package linthost

import "testing"

// TestUnicornEscapeCaseBoundsEscapeDigitRuns verifies an escape's hex digits
// stop at the escape boundary.
//
// Upstream matches `x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|u{[\dA-Fa-f]+}`: a `\x`
// escape is exactly two hex digits and a `\u` escape exactly four, so the
// literal characters behind an escape are not part of it. The Go port used
// unbounded `*` quantifiers, which let a match run past the escape and absorb
// following `a-f` letters, so the canonical `"\x41bcd"` reported as lowercase
// (issue #577). Only the braced form is variable width, and its `}` ends the
// digit run — the letters behind it stay literal too. Each over-match
// candidate is paired with the lowercase escape it would be confused with, so
// a re-widened quantifier fails here.
//
//  1. Lint canonical escapes trailed by literal `a-f` letters.
//  2. Assert they stay silent while their lowercase twins report at the
//     literal's exact range.
//  3. Assert the braced code point escape reports on its digits alone.
func TestUnicornEscapeCaseBoundsEscapeDigitRuns(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    markers []string
  }{
    {
      name:   "hex escape trailed by literal hex letters",
      source: "const s = \"\\x41bcd\";\n",
    },
    {
      name:    "lowercase hex escape",
      source:  "const s = \"\\xa9\";\n",
      markers: []string{"\"\\xa9\""},
    },
    {
      name:   "uppercase hex escape",
      source: "const s = \"\\xA9\";\n",
    },
    {
      name:    "hex escape with one lowercase digit",
      source:  "const s = \"\\xAb\";\n",
      markers: []string{"\"\\xAb\""},
    },
    {
      name:   "unicode escape trailed by literal hex letters",
      source: "const s = \"\\uABCDdef\";\n",
    },
    {
      name:    "lowercase unicode escape",
      source:  "const s = \"\\uabcd\";\n",
      markers: []string{"\"\\uabcd\""},
    },
    {
      name:   "uppercase unicode escape",
      source: "const s = \"\\uABCD\";\n",
    },
    {
      name:   "unicode escape trailed by lowercase letters",
      source: "const s = \"\\uD83Dabc\";\n",
    },
    {
      name:   "braced code point escape trailed by literal hex letters",
      source: "const s = \"\\u{1F600}abc\";\n",
    },
    {
      name:    "lowercase braced code point escape",
      source:  "const s = \"\\u{1f600}\";\n",
      markers: []string{"\"\\u{1f600}\""},
    },
    {
      name:   "uppercase braced code point escape",
      source: "const s = \"\\u{1F600}\";\n",
    },
    {
      name:    "single-digit braced code point escape",
      source:  "const s = \"\\u{a}\";\n",
      markers: []string{"\"\\u{a}\""},
    },
    {
      name:   "digits-only escapes",
      source: "const s = \"\\x41\\u0041\\u{41}\";\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, unicornEscapeCaseRuleName, test.source, test.markers...)
    })
  }
}
