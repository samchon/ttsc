package linthost

import "testing"

// TestFormatPrintWidthDeclinesLastArgHugAfterCallback verifies last-argument
// hugging declines when a leading argument is a block-bodied callback. The
// callback has a nonempty block body, so this supported plain-call layout
// places each argument on its own line instead of hugging the trailing
// object literal. The fixture owns this two-argument shape.
//
//  1. Parse a call whose first argument is a block callback and whose last
//     is an object literal, overflowing 80.
//  2. Apply format/print-width.
//  3. Assert both arguments explode onto their own indented lines.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the declines last arg hug after callback fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert both arguments explode onto their own indented lines.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases One changing case where a leading block-bodied callback must stop the trailing object from being hugged; the output explodes both arguments with the object kept flat on its own line, whereas hugging would attach the object to the closing of the callback.
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
