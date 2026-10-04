package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapeFixesUpstreamInvalidCorpus
// verifies eight authored invalid inputs rewrite to their independent
// literal expected outputs through the native fix applier.
//
// The named source/expected pairs pin the intended escaped-dollar-brace
// spellings without generating expectations from the Go rewrite. This finite
// corpus does not certify every upstream case or freedom from all bugs:
// each fixed source must reparse cleanly, and a second
// engine run over the fixed source must stay silent (fix idempotence).
//
// 1. Run the fixer over each authored invalid source.
// 2. Compare the rewritten file byte-for-byte with the independent literal output.
// 3. Reparse the output and assert the rule no longer fires on it.
//
// @evidence contracts/testing.md#behavioral-verification Eight named authored invalid cases require exact independently declared fixed strings that reparse and no longer report.
// @evidence contracts/testing.md#independent-expectations Each literal expected field is independently declared before execution; the Go rewrite does not generate its own oracle, and no unpinned upstream snapshot identity is certified.
// @evidence contracts/testing.md#distinguishing-cases Brace/both escaped forms, multiple occurrences, leading escaped backslashes and head/tail combinations change; expression substitutions and surrounding declarations remain intact.
// @evidence contracts/testing.md#execution-ownership Eight named t.Run cases belong to this discoverable Go unit host and preserve each fixture identity in shared-process engine/fix assertions. Virtual/temporary fixture execution does not install consumers, build native artifacts or launch a product host.
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
