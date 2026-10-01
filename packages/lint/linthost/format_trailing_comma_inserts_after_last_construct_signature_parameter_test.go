package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastConstructSignatureParameter verifies
// the rule reaches multi-line parameter lists on interface construct
// signatures (`new (...): T`).
//
// Interface construct signatures are a separate syntax owner. Normalizing their final parameter must preserve the new marker and return type.
//
//  1. Parse a source file with one interface containing a multi-line
//     construct signature.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The interface construct signature must gain only the comma after y:number, retaining its new marker and returned x/y object type.
// @evidence contracts/testing.md#independent-expectations TypeScript construct signatures permit terminal formal-parameter commas under Prettier all mode. The literal full output independently preserves type relationships and surrounding interface/use bytes.
// @evidence contracts/testing.md#distinguishing-cases This interface new signature differs from bare call and named method signatures, whose dedicated hosts provide sibling positives.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastConstructSignatureParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastConstructSignatureParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "interface PointFactory {\n  new (\n    x: number,\n    y: number\n  ): { x: number; y: number };\n}\nlet f: PointFactory;\nf;\n",
    "interface PointFactory {\n  new (\n    x: number,\n    y: number,\n  ): { x: number; y: number };\n}\nlet f: PointFactory;\nf;\n",
  )
}
