package linthost

import "testing"

// TestUnicornStringContentMatchesCaseInsensitivelyWhenConfigured verifies
// the `caseSensitive: false` switch and its case-sensitive default.
//
// Upstream compiles `giu` flags when `caseSensitive` is false and `gu`
// otherwise, so `"NO"` must stay silent under the default while an
// insensitive pattern must rewrite every case variant in one pass. The
// insensitive flag must also reach template quasis, which match on raw text.
//
//  1. Assert `"NO"` produces zero findings under case-sensitive `{no: yes}`.
//  2. Fix `"End of Day"`, `"END OF DAY"`, the multi-variant `"no No NO"`,
//     and a template “ `NO` “ under `caseSensitive: false` patterns.
//  3. Compare each rewritten source with the upstream oracle.
//
// @evidence contracts/testing.md#behavioral-verification Configured exact fix snapshots and the default zero-finding control distinguish ignored caseSensitive options from matching every case variant.
// @evidence contracts/testing.md#independent-expectations The documented default case sensitivity and official gu/giu matching contract establish literal EOD/yes outputs independently of the Go rule.
// @evidence contracts/testing.md#distinguishing-cases Uppercase NO is clean by default; mixed/uppercase phrases, multiple no variants and raw template text rewrite under caseSensitive:false.
// @evidence contracts/testing.md#execution-ownership TestUnicornStringContentMatchesCaseInsensitivelyWhenConfigured is the owning discoverable Go unit entry; its explicit variants and named t.Run cases preserve failure identity while engine, parser and fix operations share one Go process. Fixture files use t.TempDir; no installed consumer, native build or product child host runs.
func TestUnicornStringContentMatchesCaseInsensitivelyWhenConfigured(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "unicorn/string-content",
    `const foo = "NO";`+"\n",
    `{"patterns":{"no":"yes"}}`,
  )

  insensitiveEndOfDay := `{"patterns":{"end of day":{"suggest":"EOD","caseSensitive":false}}}`
  insensitiveNo := `{"patterns":{"no":{"suggest":"yes","caseSensitive":false}}}`
  cases := []struct {
    name     string
    source   string
    options  string
    expected string
  }{
    {
      name:     "mixed case phrase",
      source:   `const foo = "End of Day";` + "\n",
      options:  insensitiveEndOfDay,
      expected: `const foo = "EOD";` + "\n",
    },
    {
      name:     "upper case phrase",
      source:   `const foo = "END OF DAY";` + "\n",
      options:  insensitiveEndOfDay,
      expected: `const foo = "EOD";` + "\n",
    },
    {
      name:     "every variant in one string",
      source:   `const foo = "no No NO";` + "\n",
      options:  insensitiveNo,
      expected: `const foo = "yes yes yes";` + "\n",
    },
    {
      name:     "template literal",
      source:   "const foo = `NO`;\n",
      options:  insensitiveNo,
      expected: "const foo = `yes`;\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "unicorn/string-content", test.source, test.options, test.expected)
    })
  }
}
