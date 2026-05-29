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
func TestFormatQuotesKeepsDoubleOnEscapeTie(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/quotes",
    `const s = "\"'";`+"\n",
  )
}
