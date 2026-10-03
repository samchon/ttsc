package linthost

import "testing"

// TestFormatSemiIdempotentOnTerminatedMembers verifies zero findings
// on independently authored, already-terminated member spellings.
//
// The parsed member includes its written semicolon, so the insert path
// reads End()-1 and abstains. This direct rule input does not come from
// a previous formatter result and does not execute a convergence cascade.
//
//  1. Parse a Prettier-shaped interface, type literal, and class body.
//  2. Run format/semi with default options.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must emit no findings for already-terminated interface signatures, a broken type-literal property and a class index signature, preventing duplicate insertion.
// @evidence contracts/testing.md#independent-expectations The independently authored canonical literal already gives each required member its semicolon; the no-finding result follows default semi policy rather than a previous run.
// @evidence contracts/testing.md#distinguishing-cases Five interface signature shapes plus the alias property and class index signature share this host; broken-interface/type-literal insertion positives distinguish correctness from mere idempotency.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiIdempotentOnTerminatedMembers is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only fixture harness invokes the owning semicolon rule and observes zero findings in the same Go process without consumer installation, a native product build or a product host.
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
