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
func TestFormatPrintWidthHugsFirstCallbackWithArrayArg(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "useEffect(() => { doThing(); doMoreStuffHereToOverflowTheWidthForSure(); }, [aaaa, bbbb, cccc]);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "useEffect(() => {\n  doThing();\n  doMoreStuffHereToOverflowTheWidthForSure();\n}, [aaaa, bbbb, cccc]);\n",
  )
}
