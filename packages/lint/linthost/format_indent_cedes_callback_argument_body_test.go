package linthost

import "testing"

// TestFormatIndentCedesCallbackArgumentBody verifies format/indent does
// not re-indent a statement that lives inside a call-argument callback,
// ceding its indentation to format/print-width.
//
// format/indent measures depth by block nesting only; a callback body
// hung under its call-argument column sits deeper than that depth, so
// this dedicated rule cannot derive that expression-owned column.
// The indentCededToReflow guard makes the rule abstain here. This body
// does not run print-width or assert convergence of a format cascade.
//
//  1. Parse a call whose arrow argument body is indented past its block
//     depth.
//  2. Run format/indent.
//  3. Assert the rule reports nothing (the body is left to print-width).
//
// @evidence contracts/testing.md#behavioral-verification format/indent must produce no findings for the call-argument arrow body, preserving an expression-owned indentation column rather than forcing its statement to block depth.
// @evidence contracts/testing.md#independent-expectations Callback layout belongs to the printer/reflow owner, so the dedicated indentation rule must abstain even when its simple block-depth model would choose another column. This local-rule oracle does not assert that a complete formatter leaves the deliberately deeper source unchanged.
// @evidence contracts/testing.md#distinguishing-cases The callback body is six spaces deep and remains outside this rule ownership. StillFixesSingleLineHeadArrowBody covers the adjacent standalone arrow initializer that the rule does own.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentCedesCallbackArgumentBody owns the no-finding callback fixture in the public Go unit population. The shared syntax-only harness executes the owning rule in process with no consumer installation, native build or real product host.
func TestFormatIndentCedesCallbackArgumentBody(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/indent",
    "register(() => {\n      doThing()\n})\n",
    `{"tabWidth":2}`,
  )
}
