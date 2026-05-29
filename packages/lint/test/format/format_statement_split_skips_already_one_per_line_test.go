package linthost

import "testing"

// TestFormatStatementSplitSkipsAlreadyOnePerLine verifies the rule emits
// no finding when every statement already starts its own line.
//
// Idempotency: once each statement is alone on its line, step 2 abstains
// for all of them and the rule must produce nothing. This pins that a
// well-formed file is a fixed point of the split rule.
//
//  1. Parse a file with one statement per line.
//  2. Run the rule.
//  3. Assert it emits no finding.
func TestFormatStatementSplitSkipsAlreadyOnePerLine(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/statement-split",
    "const a = 1;\nconst b = 2;\nconst c = 3;\n",
  )
}
