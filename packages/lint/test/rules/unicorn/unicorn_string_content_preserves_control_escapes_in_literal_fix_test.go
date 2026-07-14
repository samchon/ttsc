package linthost

import "testing"

// TestUnicornStringContentPreservesControlEscapesInLiteralFix verifies
// control characters in the cooked value are re-spelled the way upstream's
// `quote-js-string`-based escapeString helper spells them.
//
// A literal like `"no\n"` cooks to a real newline; the fixer must not write
// that byte raw into the source (it would split the literal across lines).
// quote-js-string escapes the delimiter quote, the backslash, and every unsafe
// code point (C0 controls, DEL) — using the named escapes `\b \f \n \r \t \v`
// where they exist and a braced ES6 code-point escape `\u{HEX}` (with `\u{0}`
// for NUL) for the rest. Each expectation below is the `quote-js-string`
// spelling, not the older jsesc spelling (which left `\v`, other C0 controls,
// and DEL raw and wrote a bare `\0`).
//
//  1. Configure `{no: "yes"}` and fix literals containing named-escape
//     controls, NUL in several positions, and braced-escape controls.
//  2. Compare each rewritten literal with the upstream escape spelling.
//  3. Re-parse the fixed source, assert it stays parse-valid, and assert the
//     canonical output no longer fires.
func TestUnicornStringContentPreservesControlEscapesInLiteralFix(t *testing.T) {
  options := `{"patterns":{"no":"yes"}}`
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "newline escape",
      source:   `const foo = "no\n";` + "\n",
      expected: `const foo = "yes\n";` + "\n",
    },
    {
      name:     "carriage return escape",
      source:   `const foo = "no\r";` + "\n",
      expected: `const foo = "yes\r";` + "\n",
    },
    {
      name:     "tab escape",
      source:   `const foo = "no\t";` + "\n",
      expected: `const foo = "yes\t";` + "\n",
    },
    {
      name:     "backspace and form feed escapes",
      source:   `const foo = "no\b\f";` + "\n",
      expected: `const foo = "yes\b\f";` + "\n",
    },
    {
      name:     "vertical tab uses its named escape",
      source:   `const foo = "no\v";` + "\n",
      expected: `const foo = "yes\v";` + "\n",
    },
    {
      name:     "null byte before end uses a braced escape",
      source:   `const foo = "no\0";` + "\n",
      expected: `const foo = "yes\u{0}";` + "\n",
    },
    {
      name:     "null byte before letter uses a braced escape",
      source:   `const foo = "no\0a";` + "\n",
      expected: `const foo = "yes\u{0}a";` + "\n",
    },
    {
      name: "null byte before digit uses a braced escape",
      // The braced escape is unambiguous next to a digit, so unlike the old
      // jsesc `\0` there is no legacy-octal hazard forcing a raw byte.
      source:   `const foo = "no\x001";` + "\n",
      expected: `const foo = "yes\u{0}1";` + "\n",
    },
    {
      name:     "C0 control and DEL use braced escapes",
      source:   `const foo = "no\x01\x7f";` + "\n",
      expected: `const foo = "yes\u{1}\u{7f}";` + "\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "unicorn/string-content", test.source, options, test.expected)
      file := parseTSFile(t, "/virtual/fixed-string-content-controls.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", test.expected, options)
    })
  }
}
