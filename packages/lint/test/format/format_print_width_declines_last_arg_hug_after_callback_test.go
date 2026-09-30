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
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the declines last arg hug after callback fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert both arguments explode onto their own indented lines.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Parse a call whose first argument is a block callback and whose last is an object literal, overflowing. The asserted decision is: Assert both arguments explode onto their own indented lines. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthDeclinesLastArgHugAfterCallback is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthDeclinesLastArgHugAfterCallback(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "registerHandlerForSomething(() => { doThing(); doMoreStuff(); }, { key: 1, other: 2 });\n",
    `{"printWidth":80,"tabWidth":2}`,
    "registerHandlerForSomething(\n  () => {\n    doThing();\n    doMoreStuff();\n  },\n  { key: 1, other: 2 },\n);\n",
  )
}
