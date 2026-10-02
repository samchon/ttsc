package linthost

import "testing"

// TestFormatBraceContinuationIsIdempotentInBothDirections verifies source already in Prettier's shape produces no edit.
//
// The rule rewrites a gap it also reads, so a target text it fails to compare
// against would re-emit forever and exhaust the format cascade. Both directions
// need the check, because they synthesize different text.
//
//  1. Parse a joined `} else {` and a split `if (a) x();` / `else y();`.
//  2. Run format/brace-continuation on each.
//  3. Assert the rule reports nothing for either.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must report no finding for both the already-joined block else and the already-split statement-body else.
// @evidence contracts/testing.md#independent-expectations The two fixed literals independently specify canonical continuation placement: a block joins } else, whereas a non-block consequent gives else its own line.
// @evidence contracts/testing.md#distinguishing-cases These two canonical negatives cover both direction choices; pull-else and push-else positives establish the corresponding changes so no-op success alone cannot certify the rule.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationIsIdempotentInBothDirections is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its parsed literal sources and no-finding assertions; the shared syntax-only harness runs the owning rule in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationIsIdempotentInBothDirections(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n} else {\n  y();\n}\n",
    `{"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x();\nelse y();\n",
    `{"tabWidth":2}`,
  )
}
