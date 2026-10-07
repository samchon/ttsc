package linthost

import "testing"

// TestFormatPrintWidthHonorsUseTabsOption pins tab output when useTabs is
// enabled. The literal three-property output detects an ignored option while
// preserving the same property values, ordering and commas as the space form.
//
//  1. Configure printWidth=20 and useTabs=true.
//  2. Reflow the aa/bb/cc object.
//  3. Compare the entire output with one tab per child line.
//
// @evidence contracts/testing.md#behavioral-verification format/print-width must emit tab-indented children for the overflowing three-property object while retaining its keys, values and statement suffix.
// @evidence contracts/testing.md#independent-expectations The supported useTabs contract determines one literal tab for each child indentation level. Full-string equality distinguishes spaces, misplaced braces or lost members.
// @evidence contracts/testing.md#distinguishing-cases This host owns the enabled-tab positive. TestFormatPrintWidthBreaksLongObjectLiteral supplies the identical source with default space indentation; TestFormatPrintWidthHonorsTabLeadingSource owns input tabs rather than only output tabs.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHonorsUseTabsOption invokes the registered owning rule through assertFixSnapshotWithOptions and the same-process engine. Its selected public Go entry owns the literal case without installation, native build or product-host children.
func TestFormatPrintWidthHonorsUseTabsOption(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 20, "useTabs": true}`,
    "const x = {\n\taa: 1,\n\tbb: 2,\n\tcc: 3,\n};\n",
  )
}
