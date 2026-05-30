package linthost

import "testing"

// TestFormatIndentIdempotentOnDecoratedMember verifies an already-correct
// decorated member is a fixed point.
//
// The decorated-member declaration-line pass must not fight a canonical
// layout: when the decorator line and the declaration line both already sit
// at member depth, the rule must emit nothing, otherwise the cascade would
// oscillate. This pins idempotency for the decorator path added alongside
// the half-indent fix.
//
//  1. Parse a class whose decorator and declaration lines are both at two
//     spaces.
//  2. Run the rule.
//  3. Assert it emits no finding.
func TestFormatIndentIdempotentOnDecoratedMember(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/indent",
    "class User {\n  @Column()\n  name: string = \"\";\n}\n",
  )
}
