package linthost

import "testing"

// TestUnicornStringContentEscapesBackticksAndDollarsInTemplateFix verifies
// replacement text is re-escaped for the template-raw context.
//
// A replacement may inject backticks or `${` into a quasi; written raw they
// would terminate the template or open a substitution. Upstream's
// escapeTemplateElementRaw escapes a symbol only when preceded by an even
// number of backslashes, so `$foo` and `\\$foo` diverge — these are the four
// escape cases from the upstream suite plus the already-escaped negative.
//
//  1. Fix templates whose replacements contain backticks, `${...}` text, and
//     a `{`-completing suffix after both bare and escaped dollars.
//  2. Compare each rewritten source with the upstream oracle.
//  3. Assert an already-escaped `` \` `` template stays silent under a
//     non-matching pattern (no double escaping ever happens).
func TestUnicornStringContentEscapesBackticksAndDollarsInTemplateFix(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    options  string
    expected string
  }{
    {
      name:     "backtick in replacement",
      source:   "const foo = `foo_foo`;\n",
      options:  "{\"patterns\":{\"foo\":\"bar`bar\"}}",
      expected: "const foo = `bar\\`bar_bar\\`bar`;\n",
    },
    {
      name:     "substitution opener in replacement",
      source:   "const foo = `foo_foo`;\n",
      options:  `{"patterns":{"foo":"${bar}"}}`,
      expected: "const foo = `\\${bar}_\\${bar}`;\n",
    },
    {
      name:     "replacement completes a bare dollar",
      source:   "const foo = `$foo`;\n",
      options:  `{"patterns":{"foo":"{bar}"}}`,
      expected: "const foo = `\\${bar}`;\n",
    },
    {
      name:     "escaped backslashes keep the dollar escapable",
      source:   "const foo = `\\\\$foo`;\n",
      options:  `{"patterns":{"foo":"{bar}"}}`,
      expected: "const foo = `\\\\\\${bar}`;\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "unicorn/string-content", test.source, test.options, test.expected)
      file := parseTSFile(t, "/virtual/fixed-string-content-template.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", test.expected, test.options)
    })
  }

  // Upstream valid case: raw `\`` and `\${` spellings must not fire or be
  // rewritten when the pattern does not match.
  assertRuleSkipsSourceWithOptions(
    t,
    "unicorn/string-content",
    "const foo = `\\`\\${1}`;\n",
    `{"patterns":{"no":"yes"}}`,
  )
}
