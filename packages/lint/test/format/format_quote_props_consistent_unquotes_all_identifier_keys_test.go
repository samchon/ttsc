package linthost

import "testing"

// Test_format_quote_props_consistent_unquotes_all_identifier_keys verifies
// the "consistent" mode positive path: when every key is a plain
// identifier, all redundant quotes are removed together.
//
//  1. Provide an object literal whose keys are all quoted identifiers.
//  2. Run the format/quote-props rule in "consistent" mode.
//  3. Expect both keys to lose their quotes, since unquoting keeps the
//     object consistent.
func Test_format_quote_props_consistent_unquotes_all_identifier_keys(t *testing.T) {
  const ruleID = "format/quote-props"
  const source = "const a = { \"a\": 1, \"b\": 2 };\n"
  const optionsJSON = "{\"mode\":\"consistent\"}"
  const expected = "const a = { a: 1, b: 2 };\n"
  assertFixSnapshotWithOptions(t, ruleID, source, optionsJSON, expected)
}
