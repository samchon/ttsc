package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastMethodSignatureParameter verifies
// the rule reaches multi-line parameter lists on interface method
// signatures.
//
// A method signature declares callable shape without a body. Its final parameter must follow the same all-mode comma policy without changing its type declaration.
//
//  1. Parse a source file with one interface containing a multi-line
//     method signature.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The interface method signature must gain a comma after right:number while preserving its numeric result type, interface name and subsequent use.
// @evidence contracts/testing.md#independent-expectations TypeScript permits formal-parameter terminal commas in method signatures under Prettier all mode. The literal complete source independently preserves type meaning.
// @evidence contracts/testing.md#distinguishing-cases The method signature has no implementation body. Runtime method, bare call-signature and construct-signature hosts distinguish each declaration owner.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastMethodSignatureParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastMethodSignatureParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "interface Calculator {\n  add(\n    left: number,\n    right: number\n  ): number;\n}\nlet c: Calculator;\nc;\n",
    "interface Calculator {\n  add(\n    left: number,\n    right: number,\n  ): number;\n}\nlet c: Calculator;\nc;\n",
  )
}
