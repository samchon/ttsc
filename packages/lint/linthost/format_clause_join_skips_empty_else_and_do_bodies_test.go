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
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must report nothing for empty else and do statement bodies. These assertions prevent its space-producing join from emitting an incorrect space before the empty semicolon.
// @evidence contracts/testing.md#independent-expectations The supported formatter policy reserves spaceless empty-statement rendering for other formatting behavior; this rule deliberately abstains. The no-finding expectation follows that local ownership, while Prettier uses else; and do;.
// @evidence contracts/testing.md#distinguishing-cases The two negatives cover empty bodies behind keyword anchors; JoinsElseBody and JoinsDoBody supply nonempty positives, and SkipsEmptyStatementBody covers parenthesis-headed empty loops.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinSkipsEmptyElseAndDoBodies owns both empty-statement fixtures in the public Go unit population. The syntax-only owning rule runs in process without consumer installation, native artifact building or a real product host.
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
