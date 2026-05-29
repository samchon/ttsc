package linthost

import "testing"

// TestFormatTrailingCommaSkipsDynamicImportArgument verifies the rule
// never appends a trailing comma to a multi-line dynamic `import(...)`
// argument list, even under the default trailingComma:"all".
//
// A dynamic import parses as a CallExpression whose callee is the
// `import` keyword. Prettier exempts it from call-argument trailing
// commas (a documented historical-spec exception); the old rule treated
// it like any other call and added one. The guard keys on
// isDynamicImportCall.
//
//  1. Parse a source file with a multi-line dynamic import.
//  2. Run the rule with default (mode "all") options.
//  3. Assert it reports nothing, leaving the import comma-free.
func TestFormatTrailingCommaSkipsDynamicImportArgument(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "const m = import(\n  \"./mod\"\n);\n",
  )
}
