package linthost

import "testing"

// TestFixDotNotationSpacesDecimalIntegerReceiver verifies the dot-notation
// autofix keeps a bare decimal-integer receiver parseable by inserting a
// separating space before the dot, while radix-prefixed, float, exponent, and
// parenthesized receivers keep the dot tight.
//
// `5["toString"]` → `5.toString` is a SyntaxError (TS1351): the digit and the
// dot lex together as the float `5.`. ESLint's dot-notation inserts a space
// (`5 .toString`) only for a plain decimal integer; a hex/float/exponent
// literal ends in a non-decimal token and a parenthesized `(5)` ends in `)`,
// so the spliced dot reads as a clean member access. The receiver kind is
// inspected directly (not through `stripParens`) so `(5)` keeps the tight dot.
//
//  1. Fix bare decimal-integer receivers and assert the space is inserted.
//  2. Fix hex, float, exponent, and parenthesized receivers with the dot tight.
//  3. Re-parse every fixed output and assert it carries zero parse diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Seven named subcases run the actual fix applier and reparse every explicit expected result, exposing token merging or incorrect receiver spacing.
// @evidence contracts/testing.md#independent-expectations Literal expected spellings follow JavaScript numeric-token grammar: plain decimal integers need whitespace before the member dot, unlike radix, float, exponent or parenthesized receivers.
// @evidence contracts/testing.md#distinguishing-cases The named cases cover decimal 5, zero and numeric separators against parenthesized, hexadecimal, float and exponent receivers; full source comparison preserves each receiver spelling.
// @evidence contracts/testing.md#execution-ownership TestFixDotNotationSpacesDecimalIntegerReceiver owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestFixDotNotationSpacesDecimalIntegerReceiver(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "bare decimal integer needs a space",
      source:   "const s = 5[\"toString\"];\n",
      expected: "const s = 5 .toString;\n",
    },
    {
      name:     "zero needs a space",
      source:   "const s = 0[\"toString\"];\n",
      expected: "const s = 0 .toString;\n",
    },
    {
      name:     "numeric separators still need a space",
      source:   "const s = 1_000[\"toString\"];\n",
      expected: "const s = 1_000 .toString;\n",
    },
    {
      name:     "parenthesized receiver keeps the dot tight",
      source:   "const s = (5)[\"toString\"];\n",
      expected: "const s = (5).toString;\n",
    },
    {
      name:     "hex receiver keeps the dot tight",
      source:   "const s = 0x10[\"toString\"];\n",
      expected: "const s = 0x10.toString;\n",
    },
    {
      name:     "float receiver keeps the dot tight",
      source:   "const s = 5.0[\"toString\"];\n",
      expected: "const s = 5.0.toString;\n",
    },
    {
      name:     "exponent receiver keeps the dot tight",
      source:   "const s = 5e3[\"toString\"];\n",
      expected: "const s = 5e3.toString;\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshot(t, "dot-notation", test.source, test.expected)
      file := parseTSFile(t, "/virtual/fixed-dot-notation-numeric.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
    })
  }
}
