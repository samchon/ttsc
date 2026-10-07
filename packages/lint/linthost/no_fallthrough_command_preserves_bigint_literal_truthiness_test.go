package linthost

import "testing"

// TestNoFallthroughCommandPreservesBigIntLiteralTruthiness verifies every
// accepted BigInt radix, separators, arbitrary width, and transparent
// parentheses through the real check command. Zero twins must remain
// fallthrough-capable, while unary expressions stay outside literal folding.
//
// 1. Put truthy and falsy BigInt loop tests in adjacent switch-case pairs.
// 2. Include lower/upper prefixes, separators, nesting, and a unary boundary.
// 3. Assert only zero and unary-boundary transitions report.
//
// @evidence contracts/testing.md#behavioral-verification The in-process check matches exactly every authored zero and unary-boundary marker.
// @evidence contracts/testing.md#independent-expectations Literal BigInt zero/nonzero values in each authored radix and width independently define the supported truthiness oracle; unary minus stays outside literal folding.
// @evidence contracts/testing.md#distinguishing-cases Decimal, lower/upper radix, separator, parentheses and arbitrary-width twins retain both reporting and clean outcomes.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughCommandPreservesBigIntLiteralTruthiness is selected in the shared Go unit population and invokes assertNoFallthroughCommandMarkers and run(check) with the actual Program. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughCommandPreservesBigIntLiteralTruthiness(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `function inspect(value: number): void {
  switch (value) {
    case 0:
      while (1n) {}
    case 1:
      break;
    case 2:
      while (0n) {}
    case 3: // diagnostic
      break;
    case 4:
      while (0xF_Fn) {}
    case 5:
      break;
    case 6:
      while (0X0_0n) {}
    case 7: // diagnostic
      break;
    case 8:
      while (0b1_0n) {}
    case 9:
      break;
    case 10:
      while (0B0_0n) {}
    case 11: // diagnostic
      break;
    case 12:
      while (0o7_0n) {}
    case 13:
      break;
    case 14:
      while (0O0_0n) {}
    case 15: // diagnostic
      break;
    case 16:
      while (1_000_000n) {}
    case 17:
      break;
    case 20:
      while (((0x1n))) {}
    case 21:
      break;
    case 22:
      while (((0x0n))) {}
    case 23: // diagnostic
      break;
    case 24:
      while (0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn) {}
    case 25:
      break;
    case 26:
      while (0x0000_0000_0000_0000_0000_0000_0000_0000n) {}
    case 27: // diagnostic
      break;
    case 28:
      while ((-1n)) {}
    case 29: // diagnostic
      break;
  }
}

inspect(0);
`)
}
