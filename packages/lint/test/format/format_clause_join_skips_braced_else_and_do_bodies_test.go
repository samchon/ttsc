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
//  1. Parse an `else` and a `do` whose bodies are blocks starting on their own line.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing for either.
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
}
