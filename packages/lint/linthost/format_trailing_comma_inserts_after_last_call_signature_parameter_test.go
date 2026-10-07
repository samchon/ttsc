package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastCallSignatureParameter verifies
// the rule reaches multi-line parameter lists on bare interface call
// signatures.
//
// An interface call signature has its own syntax owner while sharing formal-parameter comma policy. Type-space signatures must not lose coverage when runtime functions are normalized.
//
//  1. Parse a source file with one interface containing a multi-line
//     bare call signature.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The interface call signature must gain a comma after right:number while retaining its return type, interface and surrounding use.
// @evidence contracts/testing.md#independent-expectations TypeScript permits a terminal comma in formal parameters, and Prettier all-mode applies that policy to interface call signatures. The literal expected signature preserves type meaning independently of its AST kind.
// @evidence contracts/testing.md#distinguishing-cases This bare interface call signature differs from named method signatures and construct signatures. Their separate positive hosts and ES5 parameter exclusion cover ownership and policy boundaries.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastCallSignatureParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastCallSignatureParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "interface Combiner {\n  (\n    left: number,\n    right: number\n  ): number;\n}\nlet c: Combiner;\nc;\n",
    "interface Combiner {\n  (\n    left: number,\n    right: number,\n  ): number;\n}\nlet c: Combiner;\nc;\n",
  )
}
