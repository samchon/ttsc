package linthost

import "testing"

// TestUnicornNumberLiteralCaseFixesEveryLiteralInOnePass verifies a file
// holding several non-canonical literals is fully normalized by a single fix
// pass, and that the canonical literals between them are left alone.
//
// Every finding contributes its own TextEdit, and `applyTextEditsToFile`
// applies the batch right-to-left against one snapshot of the source. A fix
// whose range drifted past its literal would shift the offsets of its
// neighbours and corrupt the file, which a single-literal snapshot can never
// expose.
//
//  1. Write a source mixing uppercase-exponent, mis-cased hex, BigInt, and
//     already-canonical literals — two of them on the same line.
//  2. Run the rule through the native fix applier once.
//  3. Assert every non-canonical literal is rewritten and nothing else moved.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshot verifies one batch fixes four noncanonical literals in a mixed file without moving neighboring canonical declarations.
// @evidence contracts/testing.md#independent-expectations The independent whole-source expected string applies case-only normalization while retaining every digit, separator, bigint suffix and statement.
// @evidence contracts/testing.md#distinguishing-cases Two changed literals share a line; later binary bigint and separated hex also change while the interleaved canonical pair does not.
// @evidence contracts/testing.md#execution-ownership TestUnicornNumberLiteralCaseFixesEveryLiteralInOnePass is a discoverable Go unit host; its literal fixtures and table cases execute the owning engine/fix operations in the shared Go process without consumer installation, native builds or product children. Helper failures retain each input and expected string.
func TestUnicornNumberLiteralCaseFixesEveryLiteralInOnePass(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornNumberLiteralCaseRuleName,
    "const pair = [1E3, 0Xff];\n"+
      "const kept = [1e3, 0xFF];\n"+
      "const big = 0B1010n;\n"+
      "const wide = 0xff_ff;\n",
    "const pair = [1e3, 0xFF];\n"+
      "const kept = [1e3, 0xFF];\n"+
      "const big = 0b1010n;\n"+
      "const wide = 0xFF_FF;\n",
  )
}
