package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastMethodSignatureParameter verifies
// the rule reaches multi-line parameter lists on interface method
// signatures.
//
// Prettier's `printFunctionParameters` is the single parameter printer
// for `TSMethodSignature` (prettier issue #16486 "as intended"), so a
// multi-line method signature inside an interface gains a trailing comma
// under `trailingComma: "all"`. The `KindMethodSignature` dispatch arm
// short-circuits on the es5 guard and otherwise routes through
// `considerFunctionParameterComma`. Pinning the signature path keeps
// the interface-side surface regression-safe alongside the
// `KindMethodDeclaration` peer.
//
//  1. Parse a source file with one interface containing a multi-line
//     method signature.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
func TestFormatTrailingCommaInsertsAfterLastMethodSignatureParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "interface Calculator {\n  add(\n    left: number,\n    right: number\n  ): number;\n}\nlet c: Calculator;\nc;\n",
    "interface Calculator {\n  add(\n    left: number,\n    right: number,\n  ): number;\n}\nlet c: Calculator;\nc;\n",
  )
}
