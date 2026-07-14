package linthost

import "testing"

// TestUnicornBetterRegexConstructorFixEscapesCookedPattern verifies the
// `new RegExp("pattern", "flags")` autofix re-escapes the rewritten pattern
// through the shared escapeString port instead of writing its cooked bytes back
// into the source.
//
// clean-regexp rewrites the literal's COOKED value, so a source `\n` reaches the
// fixer as a real line feed. The superseded jsesc port passed every character
// but the backslash, the delimiter quote, and U+2028 / U+2029 through raw, which
// closed the string literal early and left the file unparseable (issue #573).
// The expectations below come from upstream's escapeString oracle — the
// `quote-js-string` package the rule shares with `unicorn/string-content` — so
// the named escapes (`\n \r \t \b \f \v`), the braced `\u{HEX}` form for the
// remaining unsafe code points, and the raw pass-through of exotic whitespace,
// astral symbols, and the non-delimiter quotes are all pinned. Exotic code
// points are built from Go escapes and concatenated so every byte is explicit.
//
//  1. Fix constructors whose cooked pattern carries line terminators, controls,
//     quote characters, exotic whitespace, and astral symbols.
//  2. Compare each rewritten source with the upstream escapeString spelling.
//  3. Re-parse the fixed source, assert it stays parse-valid, and assert the
//     canonical output no longer fires.
func TestUnicornBetterRegexConstructorFixEscapesCookedPattern(t *testing.T) {
  const (
    backtick           = "`"
    lineSeparator      = " "
    paragraphSeparator = " "
    noBreakSpace       = " "
    hairSpace          = " "
    narrowNoBreakSpace = " "
    ideographicSpace   = "　"
    unicorn            = "\U0001f984"
    accentedText       = "héllo"
  )
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "line feed",
      source:   `const foo = new RegExp("[0-9]+\n");` + "\n",
      expected: `const foo = new RegExp("\\d+\n");` + "\n",
    },
    {
      name:     "line feed in a single-quoted pattern",
      source:   `const foo = new RegExp('[0-9]+\n');` + "\n",
      expected: `const foo = new RegExp('\\d+\n');` + "\n",
    },
    {
      name:     "carriage return",
      source:   `const foo = new RegExp("[0-9]+\r");` + "\n",
      expected: `const foo = new RegExp("\\d+\r");` + "\n",
    },
    {
      name:     "carriage return line feed pair",
      source:   `const foo = new RegExp("[0-9]+\r\n");` + "\n",
      expected: `const foo = new RegExp("\\d+\r\n");` + "\n",
    },
    {
      name:     "tab",
      source:   `const foo = new RegExp("[0-9]+\t");` + "\n",
      expected: `const foo = new RegExp("\\d+\t");` + "\n",
    },
    {
      name:     "backspace, form feed, and vertical tab",
      source:   `const foo = new RegExp("[0-9]\b\f\v");` + "\n",
      expected: `const foo = new RegExp("\\d\b\f\v");` + "\n",
    },
    {
      // The remaining C0 controls and DEL have no named escape, so upstream
      // spells them with the braced code-point form.
      name:     "nul, other C0 controls, and DEL",
      source:   `const foo = new RegExp("[0-9]\0\x01\x1f\x7f");` + "\n",
      expected: `const foo = new RegExp("\\d\u{0}\u{1}\u{1f}\u{7f}");` + "\n",
    },
    {
      // The braced escape stays unambiguous before a digit, where a bare `\0`
      // would read back as a legacy octal escape.
      name:     "nul followed by a digit",
      source:   `const foo = new RegExp("[0-9]\x005");` + "\n",
      expected: `const foo = new RegExp("\\d\u{0}5");` + "\n",
    },
    {
      // The source carries raw U+2028 / U+2029 line terminators.
      name: "line and paragraph separators",
      source: `const foo = new RegExp("[0-9]` + lineSeparator +
        paragraphSeparator + `");` + "\n",
      expected: `const foo = new RegExp("\\d\u{2028}\u{2029}");` + "\n",
    },
    {
      // Exotic Unicode whitespace is safe raw, so upstream does not respell it.
      name: "exotic whitespace stays raw",
      source: `const foo = new RegExp("[0-9]` + noBreakSpace + hairSpace +
        narrowNoBreakSpace + ideographicSpace + `");` + "\n",
      expected: `const foo = new RegExp("\\d` + noBreakSpace + hairSpace +
        narrowNoBreakSpace + ideographicSpace + `");` + "\n",
    },
    {
      name:     "astral symbols and accented text stay raw",
      source:   `const foo = new RegExp("[0-9]` + unicorn + accentedText + `");` + "\n",
      expected: `const foo = new RegExp("\\d` + unicorn + accentedText + `");` + "\n",
    },
    {
      // Only the delimiter quote is escaped; the other two stay raw.
      name:     "quote characters in a double-quoted pattern",
      source:   `const foo = new RegExp("[0-9]'\"` + backtick + `");` + "\n",
      expected: `const foo = new RegExp("\\d'\"` + backtick + `");` + "\n",
    },
    {
      name:     "quote characters in a single-quoted pattern",
      source:   `const foo = new RegExp('[0-9]\'"` + backtick + `');` + "\n",
      expected: `const foo = new RegExp('\\d\'"` + backtick + `');` + "\n",
    },
    {
      // `${` only needs escaping inside a template literal, never here.
      name:     "dollar brace stays raw",
      source:   `const foo = new RegExp("[0-9]${x}");` + "\n",
      expected: `const foo = new RegExp("\\d${x}");` + "\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshot(t, unicornBetterRegexRuleName, test.source, test.expected)
      file := parseTSFile(t, "/virtual/fixed-better-regex-constructor.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSource(t, unicornBetterRegexRuleName, test.expected)
    })
  }

  // The pattern-unchanged path: clean-regexp leaves `[a-z]+` alone, so the rule
  // never fires and the cooked line feed is never re-emitted.
  t.Run("pattern unchanged by clean-regexp", func(t *testing.T) {
    assertRuleSkipsSource(t, unicornBetterRegexRuleName, `const foo = new RegExp("[a-z]+\n");`+"\n")
  })
}
