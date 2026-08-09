package linthost

import "testing"

// TestFormatClauseJoinSkipsEmptyElseAndDoBodies verifies the empty-statement abstention covers the `else` and `do` clauses.
//
// Prettier glues an empty statement to its header with no space (`else;`,
// `do;`), and this rule's gap-to-space rewrite cannot produce that. Extending the
// visit set without extending the abstention would have emitted `else ;`, which
// is a shape Prettier would immediately rewrite.
//
//  1. Parse an `else` and a `do` whose bodies are bare `;`.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing for either.
func TestFormatClauseJoinSkipsEmptyElseAndDoBodies(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (ready) run();\nelse\n  ;\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "do\n  ;\nwhile (ready);\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
