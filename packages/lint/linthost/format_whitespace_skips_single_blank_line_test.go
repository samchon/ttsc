package linthost

import "testing"

// TestFormatWhitespaceSkipsSingleBlankLine verifies the rule preserves a
// single interior blank line between two statements.
//
// Prettier keeps at most one consecutive blank line; exactly one is
// allowed, so the collapse pass must not fire. This pins that a file with
// one interior blank line is a fixed point.
//
//  1. Parse two statements separated by one blank line.
//  2. Run the rule.
//  3. Assert it emits no finding.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must emit no finding for exactly one interior blank line between two clean declarations.
// @evidence contracts/testing.md#independent-expectations The literal input independently satisfies the allowed interior blank-line and final-LF contract.
// @evidence contracts/testing.md#distinguishing-cases This canonical threshold negative complements the actual three-blank-line collapse positive, so idempotency is not the sole oracle.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceSkipsSingleBlankLine is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and observes zero findings in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceSkipsSingleBlankLine(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const a = 1;\n\nconst b = 2;\n",
  )
}
