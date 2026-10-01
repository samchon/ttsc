package linthost

import "testing"

// TestFormatDeclarationHeaderIdempotentOnBrokenHeritageTypeArgs verifies the
// rule reproduces the broken-type-argument shape as a fixed point so the
// cascade converges: the rewritten type spans multiple lines, so the rule
// abstains on the second pass.
//
//  1. Parse a class header already in the broken-type-argument shape.
//  2. Run format/declaration-header.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must emit no finding for already-broken Serializer type arguments rather than disturbing the multiline generic heritage.
// @evidence contracts/testing.md#independent-expectations The independently authored canonical literal supplies the preserved union argument and method body; zero findings is the documented abstention for this already-multiline structure.
// @evidence contracts/testing.md#distinguishing-cases This unchanged generic-heritage layout is paired with the actual flat-to-broken two-argument transformation and its CRLF counterpart.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderIdempotentOnBrokenHeritageTypeArgs is selected by TestSelectedLintUnits as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and observes zero findings without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderIdempotentOnBrokenHeritageTypeArgs(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "export class KafkaRequestSerializer implements Serializer<\n  any,\n  KafkaRequest | Promise<KafkaRequest>\n> {\n  serialize() {}\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
