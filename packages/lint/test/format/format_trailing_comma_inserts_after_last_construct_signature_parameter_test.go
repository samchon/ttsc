package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastConstructSignatureParameter verifies
// the rule reaches multi-line parameter lists on interface construct
// signatures (`new (...) => T`).
//
// Construct signatures share the function-parameter printer with
// methods/calls under prettier; `KindConstructSignature` has its own
// dispatch arm with the es5 short-circuit. Pinning the construct path
// keeps the third interface-signature peer regression-safe.
//
//  1. Parse a source file with one interface containing a multi-line
//     construct signature.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
func TestFormatTrailingCommaInsertsAfterLastConstructSignatureParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "interface PointFactory {\n  new (\n    x: number,\n    y: number\n  ): { x: number; y: number };\n}\nlet f: PointFactory;\nf;\n",
    "interface PointFactory {\n  new (\n    x: number,\n    y: number,\n  ): { x: number; y: number };\n}\nlet f: PointFactory;\nf;\n",
  )
}
