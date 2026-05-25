package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastCallSignatureParameter verifies
// the rule reaches multi-line parameter lists on bare interface call
// signatures.
//
// A bare call signature inside an interface body (`(\n  a, b\n): T;`) has
// its own `KindCallSignature` dispatch arm distinct from
// `KindMethodSignature`. Prettier's `printFunctionParameters` routes
// both through the same printer, so both gain trailing commas under
// `trailingComma: "all"`. Pinning the call-signature path keeps the
// peer arm regression-safe.
//
//  1. Parse a source file with one interface containing a multi-line
//     bare call signature.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
func TestFormatTrailingCommaInsertsAfterLastCallSignatureParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "interface Combiner {\n  (\n    left: number,\n    right: number\n  ): number;\n}\nlet c: Combiner;\nc;\n",
    "interface Combiner {\n  (\n    left: number,\n    right: number,\n  ): number;\n}\nlet c: Combiner;\nc;\n",
  )
}
