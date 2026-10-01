package linthost

import "testing"

// TestFormatClauseJoinJoinsDoBody verifies a single-statement `do` body joins its `do` keyword.
//
// `KindDoStatement` was absent from the rule's visit set, so `do\n  tick();`
// survived every format pass while Prettier 3.8.3 writes `do tick();`. The `do`
// keyword is the clause's header token, the way `)` is for a `while`.
//
//  1. Parse a `do` loop whose body sits on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the body joins the `do` line and the `while` tail is untouched.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must attach tick(); to do and retain the following while tail exactly; the complete output distinguishes missing do visitation or using a closing-parenthesis anchor for this keyword header.
// @evidence contracts/testing.md#independent-expectations The supported do layout, also produced by installed Prettier 3.8.3, joins the short statement after do. The while condition and semicolon remain literal unchanged program tokens.
// @evidence contracts/testing.md#distinguishing-cases The next-line unbraced do body is a positive. SkipsEmptyElseAndDoBodies and SkipsBracedElseAndDoBodies cover the empty and block exclusions for this header.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinJoinsDoBody owns the do input and output in the public Go unit population. The syntax-only harness directly runs the owning rule and edits in process without a consumer install, native artifact build or product host.
func TestFormatClauseJoinJoinsDoBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "do\n  tick();\nwhile (ready);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "do tick();\nwhile (ready);\n",
  )
}
