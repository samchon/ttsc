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
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must emit no finding when all three declarations already begin separate lines.
// @evidence contracts/testing.md#independent-expectations The complete literal input already fulfills one-statement-per-line formatting; this canonical-form decision is not derived from a previous rule output.
// @evidence contracts/testing.md#distinguishing-cases This unchanged three-declaration negative complements the actual three-on-one-line transformation, so a no-op implementation fails the paired positive case.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitSkipsAlreadyOnePerLine is a public Go unit selected by TestSelectedLintUnits. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and observes its no-finding result in the same process, without a consumer install, native product build or host execution.
func TestFormatStatementSplitSkipsAlreadyOnePerLine(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/statement-split",
    "const a = 1;\nconst b = 2;\nconst c = 3;\n",
  )
}
