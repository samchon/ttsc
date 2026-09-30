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
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props consistent mode must remove both a and b key quotes when every object key can use an identifier spelling.
// @evidence contracts/testing.md#independent-expectations The complete output literal follows the all-removable object-group policy and retains property keys a and b, their numeric values and the const declaration.
// @evidence contracts/testing.md#distinguishing-cases This remove-quote positive owns two removable siblings; consistent mixed-object quoting distinguishes the other group decision and preserve mode owns the option that forbids changes.
// @evidence contracts/testing.md#execution-ownership Test_format_quote_props_consistent_unquotes_all_identifier_keys is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness invokes the owning rule and applies edits in process for this host's literal inputs and complete output comparisons. No consumer install, native product build or product host is started.
func Test_format_quote_props_consistent_unquotes_all_identifier_keys(t *testing.T) {
  const ruleID = "format/quote-props"
  const source = "const a = { \"a\": 1, \"b\": 2 };\n"
  const optionsJSON = "{\"mode\":\"consistent\"}"
  const expected = "const a = { a: 1, b: 2 };\n"
  assertFixSnapshotWithOptions(t, ruleID, source, optionsJSON, expected)
}
