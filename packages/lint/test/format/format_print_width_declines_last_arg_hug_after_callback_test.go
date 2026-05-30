package linthost

import "testing"

// TestFormatPrintWidthDeclinesLastArgHugAfterCallback verifies last-argument
// hugging declines when a leading argument is a block-bodied callback. The
// callback forces the call multi-line on its own, so Prettier 3.8.3
// explodes every argument onto its own line instead of hugging the trailing
// object literal.
//
//  1. Parse a call whose first argument is a block callback and whose last
//     is an object literal, overflowing 80.
//  2. Apply format/print-width.
//  3. Assert both arguments explode onto their own indented lines.
func TestFormatPrintWidthDeclinesLastArgHugAfterCallback(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "registerHandlerForSomething(() => { doThing(); doMoreStuff(); }, { key: 1, other: 2 });\n",
    `{"printWidth":80,"tabWidth":2}`,
    "registerHandlerForSomething(\n  () => {\n    doThing();\n    doMoreStuff();\n  },\n  { key: 1, other: 2 },\n);\n",
  )
}
