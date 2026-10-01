package linthost

import "testing"

// TestFormatPrintWidthHonorsTabLeadingSource separates the source line's
// eight-column indentation from the object's eighteen-column starting point.
// With four-column tabs, a broken object must preserve the original line
// prefix and indent children one additional tab. Treating tabs as single
// columns or confusing node position with base indentation changes the output.
//
//  1. Configure printWidth=24, tabWidth=4 and useTabs=true.
//  2. Reflow the object after two source tabs and the const declaration prefix.
//  3. Require three tabs on child lines and two on the closing brace.
//
// @evidence contracts/testing.md#behavioral-verification The actual rule engine must preserve the two-tab declaration prefix and break the object with three-tab child and two-tab closing indentation, retaining all keys and values.
// @evidence contracts/testing.md#independent-expectations Literal tab arithmetic gives base indentation eight and object start eighteen. Prettier 3.8.3 independently confirms the object's member layout, but its whole-file formatter removes the extraneous top-level indent; this assertion deliberately pins the rule's node-local preservation contract rather than claiming whole-file parity.
// @evidence contracts/testing.md#distinguishing-cases Existing source tabs distinguish input-column handling from TestFormatPrintWidthHonorsUseTabsOption's output-only option. Exact full text checks both unchanged prefix and changed child indentation; the direct leading-column host owns tab-stop boundaries.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHonorsTabLeadingSource owns this source/options pair through the in-process registered rule and literal snapshot helper. No native producer, installed consumer or child product host participates.
func TestFormatPrintWidthHonorsTabLeadingSource(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "\t\tconst x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 24, "tabWidth": 4, "useTabs": true}`,
    "\t\tconst x = {\n\t\t\taa: 1,\n\t\t\tbb: 2,\n\t\t\tcc: 3,\n\t\t};\n",
  )
}
