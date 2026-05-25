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
func TestFormatPrintWidthHugsArrowWithObjectBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "collect(\n  (item) => ({ id: item }),\n);\n",
    `{"printWidth": 25}`,
    "collect((item) => ({\n  id: item,\n}));\n",
  )
}
