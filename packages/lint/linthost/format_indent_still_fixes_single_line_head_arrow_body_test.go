package linthost

import "testing"

// TestFormatIndentStillFixesSingleLineHeadArrowBody guards against the
// multi-line-head cede over-reaching: an arrow whose head is on ONE line
// (`const f = () => {`) opens its block at column 0, so depth*tabWidth is
// correct and format/indent must still fix a mis-indented body. Pairs with
// TestFormatIndentCedesBodyUnderMultilineArrowHead.
//
//  1. Parse a single-line-head arrow whose body statement has no indent.
//  2. Apply format/indent.
//  3. Assert the body is indented to one level.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must indent the flush-left statement inside an ordinary one-head arrow by two spaces. Complete output distinguishes an overly broad continuation-body exclusion that cedes every arrow.
// @evidence contracts/testing.md#independent-expectations The supported ordinary block indentation applies when the arrow header starts on its initializer line. Literal expected source retains the variable declaration without adding a semicolon, since this rule only owns indentation.
// @evidence contracts/testing.md#distinguishing-cases This positive has a single-line arrow header at the top-level column. CedesBodyUnderMultilineArrowHead supplies the chained/wrapped negative and CedesCallbackArgumentBody supplies expression-owned callback layout.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentStillFixesSingleLineHeadArrowBody owns the literal source/options/output in the public Go unit population. The syntax-only owning rule and edit harness execute in process without a consumer install, native artifact build or product host.
func TestFormatIndentStillFixesSingleLineHeadArrowBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/indent",
    "const f = () => {\nconst x = 1\n}\n",
    `{"tabWidth":2}`,
    "const f = () => {\n  const x = 1\n}\n",
  )
}
