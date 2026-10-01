package linthost

import "testing"

// TestFormatClauseJoinJoinsWithBody verifies a single-statement `with` body joins its header line.
//
// `with` is a `)`-headed clause Prettier joins like `while`, and it was simply
// missing from the visit set. The statement is rare and illegal in strict mode,
// which is exactly why nothing else in the corpus would have caught it.
//
//  1. Parse a `with` statement whose body sits on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the body joins the header line.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must join the short run statement to the with header. The literal full output detects omitting WithStatement visitation and retains the scope expression and call.
// @evidence contracts/testing.md#independent-expectations The supported formatter policy and installed Prettier reference join this unbraced with body. This is a syntax/layout assertion for a sloppy-script construct, not a claim that with is valid in strict-mode TypeScript.
// @evidence contracts/testing.md#distinguishing-cases The next-line with statement supplies a distinct parenthesis-headed positive beyond loop and if cases. The joined-if and braced-body hosts cover shared same-line and block exclusions.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinJoinsWithBody owns the parsed syntax fixture in the public Go unit population. It uses the direct rule/edit harness in process, with no consumer install, native compilation or real product host.
func TestFormatClauseJoinJoinsWithBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "with (scope)\n  run();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "with (scope) run();\n",
  )
}
