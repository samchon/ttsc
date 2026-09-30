package linthost

import "testing"

// TestFormatSemiIdempotentOnTerminatedMembers verifies the member insert is
// idempotent on its own output.
//
// The inserted `;` is folded back into the member's range by the next
// parse, so the second pass must read it at End()-1 and abstain. A rule
// that re-reported here would spin the format cascade to its pass cap and
// exit non-zero, and would break the fixed point an already-Prettier-shaped
// file is entitled to.
//
//  1. Parse a Prettier-shaped interface, type literal, and class body.
//  2. Run format/semi with default options.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must emit no findings for already-terminated interface signatures, a broken type-literal property and a class index signature, preventing duplicate insertion.
// @evidence contracts/testing.md#independent-expectations The independently authored canonical literal already gives each required member its semicolon; the no-finding result follows default semi policy rather than a previous run.
// @evidence contracts/testing.md#distinguishing-cases Five interface signature shapes plus the alias property and class index signature share this host; broken-interface/type-literal insertion positives distinguish correctness from mere idempotency.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiIdempotentOnTerminatedMembers is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only fixture harness invokes the owning semicolon rule and observes zero findings in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiIdempotentOnTerminatedMembers(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/semi",
    "interface Shape {\n"+
      "  value: string;\n"+
      "  method(): void;\n"+
      "  [key: string]: string;\n"+
      "  (): void;\n"+
      "  new (): Shape;\n"+
      "}\n"+
      "type Alias = {\n"+
      "  name: string;\n"+
      "};\n"+
      "class Value {\n"+
      "  [key: string]: string;\n"+
      "}\n",
  )
}
