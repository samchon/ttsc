package linthost

import "testing"

// TestFormatIndentCedesCallbackArgumentBody verifies format/indent does
// not re-indent a statement that lives inside a call-argument callback,
// ceding its indentation to format/print-width.
//
// format/indent measures depth by block nesting only; a callback body
// hung under its call-argument column sits deeper than that depth, so
// re-indenting it would both corrupt the (print-width-chosen or already
// correct) layout and ping-pong against print-width every cascade pass.
// The indentCededToReflow guard makes the rule abstain here.
//
//  1. Parse a call whose arrow argument body is indented past its block
//     depth.
//  2. Run format/indent.
//  3. Assert the rule reports nothing (the body is left to print-width).
func TestFormatIndentCedesCallbackArgumentBody(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/indent",
    "register(() => {\n      doThing()\n})\n",
    `{"tabWidth":2}`,
  )
}
