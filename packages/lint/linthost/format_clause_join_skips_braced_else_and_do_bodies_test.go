package linthost

import "testing"

// TestFormatClauseJoinSkipsBracedElseAndDoBodies verifies a braced `else` or
// `do` body keeps its own line.
//
// This is the negative twin of the labeled-block case, and a scope decision
// rather than an oracle claim: Prettier pulls a brace up for every clause
// (`if (a) {`, `else {`, `do {`), and this rule takes on only the label, whose
// braced body it already has to join. Brace-on-next-line style is the sibling
// concern. Without this case the braced-body gate is pinned only in the
// direction that joins, so widening it to `else`, `do`, and `with` would pass
// the whole suite.
//
//  1. Parse else and do with next-line multiline and single-line blocks.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing for all four bodies.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must return no findings for braced else and do bodies, whether their interiors are multiline or single-line. The added short blocks distinguish the Block exclusion from an unrelated multiline-body gate.
// @evidence contracts/testing.md#independent-expectations The supported local rule leaves ordinary block brace placement to sibling formatting operations. Its no-finding oracle is a scope boundary, not a claim that a full Prettier pass leaves brace-on-next-line style untouched.
// @evidence contracts/testing.md#distinguishing-cases The original two multiline blocks remain and corresponding short next-line blocks are added for both keyword anchors. JoinsElseBody and JoinsDoBody provide unbraced positives; the labeled-block host owns the deliberate block exception.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinSkipsBracedElseAndDoBodies owns all four literal negatives in the public Go unit population. The syntax-only owning operation runs in process without consumer installation, native building or a real product host.
func TestFormatClauseJoinSkipsBracedElseAndDoBodies(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (ready) run();\nelse\n{\n  stop();\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "do\n{\n  tick();\n} while (ready);\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/clause-join",
    "if (ready) run();\nelse\n{ stop(); }\n", `{"printWidth":80,"tabWidth":2}`)
  assertRuleSkipsSourceWithOptions(t, "format/clause-join",
    "do\n{ tick(); } while (ready);\n", `{"printWidth":80,"tabWidth":2}`)
}
