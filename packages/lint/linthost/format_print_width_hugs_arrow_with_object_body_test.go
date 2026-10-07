package linthost

import "testing"

// TestFormatPrintWidthHugsArrowWithObjectBody verifies the rule hugs a
// trailing arrow argument whose body is a parenthesized object literal
// — `foo((x) => ({ … }))` — keeping the callback attached to the parens
// instead of exploding the argument list.
//
// Prettier's couldExpandArg treats an arrow whose body is an object,
// array or block as expandable; shouldHugLastArgument mirrors that by
// unwrapping the `(…)` around the object body. forceBreakFirstGroup
// then commits the inner object to its multi-line shape so the hugged
// option is genuinely distinct from the all-flat one.
//
//  1. Configure printWidth=25 — the all-flat call overflows.
//  2. Feed an exploded call with an arrow-object-body argument.
//  3. Assert the arrow hugs the parens and the object breaks.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the hugs arrow with object body fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the arrow hugs the parens and the object breaks.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=25 — the all-flat call overflows. The asserted decision is: Assert the arrow hugs the parens and the object breaks. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHugsArrowWithObjectBody is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthHugsArrowWithObjectBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "collect(\n  (item) => ({ id: item }),\n);\n",
    `{"printWidth": 25}`,
    "collect((item) => ({\n  id: item,\n}));\n",
  )
}
