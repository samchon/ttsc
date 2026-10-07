package linthost

import "testing"

// TestFormatPrintWidthHugsObjectArgumentDespiteLongTrailingSuffix
// verifies a multi-line reflow keeps hugging its object argument even
// when a long un-movable suffix (` satisfies T;`) follows the call.
//
// The suffix lands on the reflow's short last line, never on the hugged
// opening line. The rule renders at the full printWidth budget and
// re-renders with a suffix-reduced budget only for an overflowing flat
// result. This authored multiline result distinguishes charging the
// suffix against every interior line; it does not execute an earlier
// revision or an external formatter.
//
//  1. Configure printWidth=30; the suffix ` satisfies …;` is 28 wide.
//  2. Feed an exploded call followed by the long suffix.
//  3. Assert the object hugs the parens instead of exploding.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the hugs object argument despite long trailing suffix fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the object hugs the parens instead of exploding.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=30; the suffix ` satisfies …;` is 28 wide. The asserted decision is: Assert the object hugs the parens instead of exploding. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHugsObjectArgumentDespiteLongTrailingSuffix is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthHugsObjectArgumentDespiteLongTrailingSuffix(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "wrap(\n  {\n    a: 1,\n  },\n) satisfies VeryLongTypeName;\n",
    `{"printWidth": 30}`,
    "wrap({\n  a: 1,\n}) satisfies VeryLongTypeName;\n",
  )
}
