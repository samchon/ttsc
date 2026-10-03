package linthost

import "testing"

// TestFormatClauseJoinJoinsDoBody verifies a single-statement `do` body joins its `do` keyword.
//
// The rule visits KindDoStatement and uses `do` as its clause header token,
// rather than the `)` anchor used for a `while`. The direct snapshot owns the
// joined body and unchanged tail, without observing historical format passes.
//
//  1. Parse a `do` loop whose body sits on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the body joins the `do` line and the `while` tail is untouched.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must attach tick(); to do and retain the following while tail exactly; the complete output distinguishes missing do visitation or using a closing-parenthesis anchor for this keyword header.
// @evidence contracts/testing.md#independent-expectations The independently authored supported do layout joins the short statement after do. The while condition and semicolon remain literal unchanged program tokens; this body does not obtain external formatter output.
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
