package linthost

import "testing"

// TestUnicornStringContentEscapesLineSeparatorsKeepsOtherWhitespaceRaw
// verifies the literal fixer escapes only the whitespace code points upstream's
// `quote-js-string`-based escapeString helper treats as unsafe.
//
// quote-js-string escapes just the U+2028 / U+2029 line and paragraph
// separators among the whitespace class (they are real Unicode line
// terminators that break line-oriented tooling), spelling them as braced ES6
// code-point escapes `\u{2028}` / `\u{2029}`. Every other Unicode space — NBSP,
// the U+2000–U+200A group, U+202F, U+205F, U+3000 — is safe and passes through
// raw, as do accented text and astral symbols. This is the load-bearing
// difference from the older jsesc port, which re-spelled the whole exotic
// whitespace class as `\xXX` / `\uXXXX`. Exotic code points are built from Go
// escapes and concatenated so every byte is explicit.
//
//  1. Configure `{no: "yes"}` and fix literals whose cooked values carry
//     line separators, exotic whitespace, accented text, and an astral emoji.
//  2. Compare each rewritten literal with the upstream quote-js-string spelling.
//  3. Re-parse the fixed source, assert it stays parse-valid, and assert the
//     canonical output no longer fires.
//
// @evidence contracts/testing.md#behavioral-verification Exact rewritten source, parse validity and zero findings on the result distinguish line-separator escapes from unwanted rewriting of safe Unicode text.
// @evidence contracts/testing.md#independent-expectations The independent quote-js-string spelling contract escapes U+2028/U+2029 with braced code points while leaving the authored safe whitespace and Unicode characters raw.
// @evidence contracts/testing.md#distinguishing-cases Line/paragraph separators differ from NBSP, hair space and narrow NBSP; accented and astral characters must remain intact while no becomes yes.
// @evidence contracts/testing.md#execution-ownership TestUnicornStringContentEscapesLineSeparatorsKeepsOtherWhitespaceRaw is the owning discoverable Go unit entry; its explicit variants and named t.Run cases preserve failure identity while engine, parser and fix operations share one Go process. Fixture files use t.TempDir; no installed consumer, native build or product child host runs.
func TestUnicornStringContentEscapesLineSeparatorsKeepsOtherWhitespaceRaw(t *testing.T) {
  const (
    lineSeparator      = "\u2028"
    paragraphSeparator = "\u2029"
    noBreakSpace       = "\u00a0"
    hairSpace          = "\u200a"
    narrowNoBreakSpace = "\u202f"
    unicorn            = "\U0001f984"
  )
  options := `{"patterns":{"no":"yes"}}`
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name: "line and paragraph separators use braced escapes",
      // The source carries raw U+2028 / U+2029 line terminators; quote-js-string
      // re-spells them with braced ES6 code-point escapes.
      source:   `const foo = "no` + lineSeparator + `no` + paragraphSeparator + `";` + "\n",
      expected: `const foo = "yes\u{2028}yes\u{2029}";` + "\n",
    },
    {
      name: "no-break space stays raw",
      // NBSP is a safe code point; the fixer must leave the cooked byte raw
      // rather than escaping it the way jsesc did.
      source:   `const foo = "no` + noBreakSpace + `after";` + "\n",
      expected: `const foo = "yes` + noBreakSpace + `after";` + "\n",
    },
    {
      name:     "hair and narrow no-break spaces stay raw",
      source:   `const foo = "no` + hairSpace + `no` + narrowNoBreakSpace + `";` + "\n",
      expected: `const foo = "yes` + hairSpace + `yes` + narrowNoBreakSpace + `";` + "\n",
    },
    {
      name:     "accented text and astral symbols stay raw",
      source:   `const foo = "no héllo ` + unicorn + `";` + "\n",
      expected: `const foo = "yes héllo ` + unicorn + `";` + "\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "unicorn/string-content", test.source, options, test.expected)
      file := parseTSFile(t, "/virtual/fixed-string-content-whitespace.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", test.expected, options)
    })
  }
}
