package linthost

import "testing"

// TestFormatQuotesKeepsDoubleOnEscapeTie verifies the configured
// preference breaks an escape-count tie: a double-quoted literal whose
// single- and double-quoted forms need the same number of escapes stays
// double under prefer:"double", so the rule emits no edit.
//
// This pins the tie branch of the minimize-escapes logic. `"\"'"` needs
// one escape as double (the `\"`) and one as single (the bare `'`), a
// tie that must resolve to the preferred double quote and leave the
// source untouched (keeping the rule idempotent).
//
//  1. Parse a source file with a double-quoted literal that ties.
//  2. Run the rule with default (prefer:"double") options.
//  3. Assert the rule reports nothing and the source is unchanged.
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must emit no finding for the already-preferred double-quoted literal when both delimiter choices require one escape.
// @evidence contracts/testing.md#independent-expectations The fixed source literal contains a double quote and an apostrophe; the configured tie policy selects its current double delimiter independently of the rule computation.
// @evidence contracts/testing.md#distinguishing-cases This one-versus-one tie is the negative counterpart to default-double conversion; strict-cost positives distinguish preference from unconditional retention.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesKeepsDoubleOnEscapeTie is a public Go unit selected by TestSelectedLintUnits. This host owns its literal source and no-finding assertions; the shared syntax-only harness invokes the owning rule in process without a consumer install, native product build or product host.
func TestFormatQuotesKeepsDoubleOnEscapeTie(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/quotes",
    `const s = "\"'";`+"\n",
  )
}
