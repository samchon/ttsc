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
func TestFormatIndentHonorsUseTabsOption(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/indent",
    "function f() {\nreturn 1;\n}\n",
    `{"useTabs":true}`,
    "function f() {\n\treturn 1;\n}\n",
  )
}
