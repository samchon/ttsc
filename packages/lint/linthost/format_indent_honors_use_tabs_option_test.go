package linthost

import "testing"

// TestFormatIndentHonorsUseTabsOption verifies the rule indents with tab
// characters when `useTabs` is set.
//
// Under useTabs the depth-N indent is N tab characters, not N*tabWidth
// spaces. This pins that `format/indent` reads the shared layout's
// useTabs flag rather than always emitting spaces.
//
//  1. Parse a function whose body statement is flush left.
//  2. Apply the rule with `{"useTabs":true}` through the disk-backed fixer.
//  3. Assert the body statement is indented with one tab.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must insert one tab before the flush-left function return under useTabs. The literal byte comparison distinguishes silently rendering spaces and retains the return value.
// @evidence contracts/testing.md#independent-expectations The supported useTabs mode uses one tab per block indentation level. The expected tab byte is independent of the shared layout computation, while the ordinary function header and closing brace remain unchanged.
// @evidence contracts/testing.md#distinguishing-cases This positive changes the one-level body to a tab; HonorsCustomTabWidth and the default two-space host cover adjacent space-based option behavior.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentHonorsUseTabsOption owns its literal fixture and useTabs option in the public Go unit population. The owning rule/edit harness works in the same process without installing a consumer, building native artifacts or launching a real product host.
func TestFormatIndentHonorsUseTabsOption(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/indent",
    "function f() {\nreturn 1;\n}\n",
    `{"useTabs":true}`,
    "function f() {\n\treturn 1;\n}\n",
  )
}
