package linthost

import "testing"

// TestFormatPrintWidthHugsFirstCallbackWithArrayArg verifies first-argument
// hugging fires when the trailing argument is an array literal — the
// canonical `useEffect(() => { … }, [deps])` idiom. Prettier 3.8.3 keeps
// the leading callback attached to the open paren and flows `, [deps])`
// after its closing brace rather than exploding both arguments.
//
//  1. Parse a two-argument call (block callback, array) that overflows 80.
//  2. Apply format/print-width.
//  3. Assert the callback hugs and the array trails its closing brace.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the hugs first callback with array arg fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the callback hugs and the array trails its closing brace.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Parse a two-argument call (block callback, array) that overflows. The asserted decision is: Assert the callback hugs and the array trails its closing brace. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHugsFirstCallbackWithArrayArg is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthHugsFirstCallbackWithArrayArg(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "useEffect(() => { doThing(); doMoreStuffHereToOverflowTheWidthForSure(); }, [aaaa, bbbb, cccc]);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "useEffect(() => {\n  doThing();\n  doMoreStuffHereToOverflowTheWidthForSure();\n}, [aaaa, bbbb, cccc]);\n",
  )
}
