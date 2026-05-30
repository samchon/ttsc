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
func TestFormatDeclarationHeaderIdempotentOnBrokenHeritageTypeArgs(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "export class KafkaRequestSerializer implements Serializer<\n  any,\n  KafkaRequest | Promise<KafkaRequest>\n> {\n  serialize() {}\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
