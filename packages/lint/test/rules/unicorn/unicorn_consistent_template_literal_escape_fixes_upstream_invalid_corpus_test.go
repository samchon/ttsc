package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapeFixesUpstreamInvalidCorpus
// verifies every invalid case of the upstream snapshot rewrites to the
// upstream fix output through the native fix applier.
//
// The expected outputs are transcribed from eslint-plugin-unicorn's
// test/snapshots/consistent-template-literal-escape.js.md, so the port
// cannot lock in its own bugs: each case is a mangled-input-to-canonical
// transformation, the fixed source must reparse cleanly, and a second
// engine run over the fixed source must stay silent (fix idempotence).
//
// 1. Run the fixer over each upstream invalid source.
// 2. Compare the rewritten file byte-for-byte with the upstream output.
// 3. Reparse the output and assert the rule no longer fires on it.
func TestUnicornConsistentTemplateLiteralEscapeFixesUpstreamInvalidCorpus(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "brace escaped",
      source:   "const foo = `$\\{a}`\n",
      expected: "const foo = `\\${a}`\n",
    },
    {
      name:     "both escaped",
      source:   "const foo = `\\$\\{a}`\n",
      expected: "const foo = `\\${a}`\n",
    },
    {
      name:     "multiple occurrences",
      source:   "const foo = `$\\{a} and $\\{b}`\n",
      expected: "const foo = `\\${a} and \\${b}`\n",
    },
    {
      name:     "escaped backslash before brace escape",
      source:   "const foo = `\\\\$\\{a}`\n",
      expected: "const foo = `\\\\\\${a}`\n",
    },
    {
      name:     "escaped backslash before both escaped",
      source:   "const foo = `\\\\\\$\\{a}`\n",
      expected: "const foo = `\\\\\\${a}`\n",
    },
    {
      name:     "head element",
      source:   "const foo = `$\\{a}${expr}`\n",
      expected: "const foo = `\\${a}${expr}`\n",
    },
    {
      name:     "tail element",
      source:   "const foo = `${expr}$\\{a}`\n",
      expected: "const foo = `${expr}\\${a}`\n",
    },
    {
      name:     "head and tail elements",
      source:   "const foo = `$\\{a}${expr}$\\{b}`\n",
      expected: "const foo = `\\${a}${expr}\\${b}`\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshot(t, unicornConsistentTemplateLiteralEscapeRuleName, test.source, test.expected)
      file := parseTSFile(t, "/virtual/fixed-template-literal-escape.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSource(t, unicornConsistentTemplateLiteralEscapeRuleName, test.expected)
    })
  }
}
