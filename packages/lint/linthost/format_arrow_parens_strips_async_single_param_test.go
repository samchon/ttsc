package linthost

import "testing"

// TestFormatArrowParensStripsAsyncSingleParam verifies prefer:"avoid" strips
// the parens of an async single-identifier arrow (`async (x) =>` becomes
// `async x =>`); the async modifier precedes the parameter span, so the
// rewrite touches only the parameter.
//
//  1. Parse `async (x) => x`.
//  2. Apply format/arrow-parens with prefer:"avoid".
//  3. Assert it becomes `async x => x`.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must strip the eligible async singleton wrapper under avoid while keeping the async modifier, i binding and identity arrow body.
// @evidence contracts/testing.md#independent-expectations The literal expected source follows the permitted async bare-identifier grammar and independently retains every non-wrapper token.
// @evidence contracts/testing.md#distinguishing-cases The changed async singleton complements ordinary singleton stripping and comma-bearing async stripping; comment and type guards own the ineligible negatives.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensStripsAsyncSingleParam is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness calls the owning arrow rule on temporary fixture source and applies reported edits for snapshots; this host owns every named case without a consumer install, native product build or product host.
func TestFormatArrowParensStripsAsyncSingleParam(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/arrow-parens",
    "const i = async (x) => x;\n",
    `{"prefer":"avoid"}`,
    "const i = async x => x;\n",
  )
}
