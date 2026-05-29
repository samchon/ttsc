package linthost

import "testing"

// TestRuleCorpusUnicornPreferNumberProperties verifies
// unicorn/prefer-number-properties reports a global `isNaN(...)` call.
//
// The rule walks identifiers and matches the six shadowable names, but gates
// out property-name slots and binding positions so a `Number.isNaN(...)` call
// or a `{isNaN: 1}` key does not trigger. This fixture pins the bare-call
// positive case, which is the most common spelling and the one most likely to
// regress if the parent-position gate is loosened too far.
//
// 1. Enable unicorn/prefer-number-properties via an expect annotation.
// 2. Invoke the global `isNaN(0)`.
// 3. Assert the identifier is reported.
func TestRuleCorpusUnicornPreferNumberProperties(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-number-properties.ts", "// expect: unicorn/prefer-number-properties error\nvoid isNaN(0);\n")
}
