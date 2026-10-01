package linthost

import "testing"

// TestFormatClauseJoinJoinsSingleIfBody verifies a single-statement `if`
// body on its own line is joined onto the header when it fits printWidth.
//
// Prettier writes `if (a) b();` rather than breaking a short unbraced
// body onto the next line. The rule rewrites only the whitespace gap
// after the header's `)`.
//
//  1. Parse an `if` whose body sits on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the body joins the header line.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must replace the next-line gap after if (a) with one space. The complete snapshot catches a missing join or modification to the condition and call.
// @evidence contracts/testing.md#independent-expectations The literal supported short-if layout if (a) b(); is independently determined by clause formatting; the input condition and statement remain unchanged program tokens.
// @evidence contracts/testing.md#distinguishing-cases The short unbraced next-line body is the basic positive. IdempotentOnJoinedBody supplies its same-line negative, KeepsOverlongBodyBroken supplies the width distinction and SkipsBracedBody supplies the block distinction.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinJoinsSingleIfBody owns the literal source and output in the public Go unit population. The syntax-only harness directly runs clause-join and applies edits in process without a consumer installation, native artifact build or product host.
func TestFormatClauseJoinJoinsSingleIfBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "if (a)\n  b();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "if (a) b();\n",
  )
}
