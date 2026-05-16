package linthost

import "testing"

// TestFixEqeqeqReplacesSameTypeLiteralOperator verifies eqeqeq literal autofix output.
//
// Same-type literal comparisons are safe under ESLint's eqeqeq fixer because
// strict equality preserves the comparison result. The native fixer should
// offer the same automatic edit for that branch.
//
// 1. Parse a source file with a loose comparison between two number literals.
// 2. Apply the eqeqeq finding's text edit through the disk-backed fixer.
// 3. Assert only the operator changes from `!=` to `!==`.
func TestFixEqeqeqReplacesSameTypeLiteralOperator(t *testing.T) {
  assertFixSnapshot(
    t,
    "eqeqeq",
    "const changed = 1 != 2;\nJSON.stringify(changed);\n",
    "const changed = 1 !== 2;\nJSON.stringify(changed);\n",
  )
}
