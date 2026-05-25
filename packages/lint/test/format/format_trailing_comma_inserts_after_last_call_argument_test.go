package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastCallArgument verifies the trailing
// comma reaches multi-line call expressions.
//
// Function calls (and `new` expressions) split argument lists across lines
// often enough that prettier's docs flag this as one of the primary reasons
// trailing commas reduce code-review noise. The rule must cover both forms;
// this scenario pins the CallExpression branch.
//
// 1. Parse a source file with one multi-line call site.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
func TestFormatTrailingCommaInsertsAfterLastCallArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "JSON.stringify(\n  {\n    a: 1,\n    b: 2,\n  },\n  null,\n  2\n);\n",
    "JSON.stringify(\n  {\n    a: 1,\n    b: 2,\n  },\n  null,\n  2,\n);\n",
  )
}
