package linthost

import "testing"

// TestUnicornStringContentAppliesFirstMatchingPatternInConfiguredOrder
// verifies pattern precedence follows JS object-entry order.
//
// Upstream picks `replacements.find(...)` — the FIRST configured pattern
// whose regex matches — and only that pattern's occurrences are replaced.
// Order is therefore behavior: the conflicting `{a: "A", A: "a"}` pair from
// the upstream suite flips its outcome when reversed, and JS enumerates
// canonical integer keys before string keys regardless of spelling order.
// A naive Go map decode would randomize all of this.
//
//  1. Fix `"aA"` under `{a:"A", A:"a"}` and the reversed spelling.
//  2. Assert the first spelling yields `"AA"` and the reverse `"aa"`.
//  3. Fix `"b1"` under `{b:"bee", "1":"one"}` and assert the integer key
//     wins (`"bone"`), pinning JS property-enumeration order.
func TestUnicornStringContentAppliesFirstMatchingPatternInConfiguredOrder(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    options  string
    expected string
  }{
    {
      name:     "lowercase pattern configured first",
      source:   `const foo = "aA";` + "\n",
      options:  `{"patterns":{"a":"A","A":"a"}}`,
      expected: `const foo = "AA";` + "\n",
    },
    {
      name:     "uppercase pattern configured first",
      source:   `const foo = "aA";` + "\n",
      options:  `{"patterns":{"A":"a","a":"A"}}`,
      expected: `const foo = "aa";` + "\n",
    },
    {
      name:     "integer keys enumerate before string keys",
      source:   `const foo = "b1";` + "\n",
      options:  `{"patterns":{"b":"bee","1":"one"}}`,
      expected: `const foo = "bone";` + "\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "unicorn/string-content", test.source, test.options, test.expected)
    })
  }
}
