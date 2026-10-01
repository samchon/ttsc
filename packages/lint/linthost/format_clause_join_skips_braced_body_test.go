package linthost

import "testing"

// TestFormatClauseJoinSkipsBracedBody verifies a braced clause body is
// never collapsed onto the header line.
//
// Prettier keeps `if (a) {\n  b();\n}` block form; only an unbraced
// single statement is a join candidate. The rule abstains on a Block
// body, so a brace-on-next-line style (not this rule's concern) is left
// for the block/print-width machinery.
//
//  1. Parse if with a multiline block and a next-line single-line block.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning clause-join rule must report nothing for both the original multiline if block and a single-line block placed after a newline. The second negative specifically distinguishes the Block exclusion from a multiline-body restriction.
// @evidence contracts/testing.md#independent-expectations The dedicated clause-join contract excludes ordinary braced bodies; moving their opening brace belongs to other formatter rules. No-finding expectations intentionally describe this local rule rather than complete Prettier output.
// @evidence contracts/testing.md#distinguishing-cases The original brace-on-header multiline block remains. A next-line one-line block supplies an adjacent negative that would otherwise fit the join budget; JoinsSingleIfBody supplies the unbraced positive and JoinsLabeledBlockBody the label exception.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinSkipsBracedBody owns both no-finding fixtures in the public Go unit population. The syntax-only harness executes only the owning rule in process without a consumer install, native artifact build or real product host.
func TestFormatClauseJoinSkipsBracedBody(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (a) {\n  b();\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/clause-join",
    "if (a)\n{ b(); }\n", `{"printWidth":80,"tabWidth":2}`)
}
