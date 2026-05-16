package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastFunctionParameter verifies the rule
// reaches multi-line function parameter lists.
//
// Parameter lists are the riskiest shape: the closing `)` is not adjacent to
// the parameter list's End() (TypeScript carries an optional return type
// annotation between them). The rule's `findCloseTokenAfter` scanner exists
// precisely to navigate that gap. This scenario locks the scanner so a
// future refactor that assumes `parameters.End()` is the close paren
// cannot regress.
//
// 1. Parse a source file with one multi-line function declaration.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma.
func TestFormatTrailingCommaInsertsAfterLastFunctionParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "function add(\n  left: number,\n  right: number\n): number {\n  return left + right;\n}\n",
    "function add(\n  left: number,\n  right: number,\n): number {\n  return left + right;\n}\n",
  )
}
