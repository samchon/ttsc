package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksGenericHeritageTypeArgs verifies a lone
// heritage clause whose single generic type has two or more type arguments
// breaks the argument list (not the clause), matching Prettier 3.8.3:
// `implements Serializer<` stays inline, the arguments break one per line
// with `>` back at the base indent and the brace glued.
//
//  1. Parse a class implementing one generic type with two type arguments,
//     overflowing 80.
//  2. Apply format/declaration-header.
//  3. Assert the type-argument list breaks and the keyword stays inline.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must break the two Serializer type arguments while keeping implements inline and preserving export, the union argument and serialize method.
// @evidence contracts/testing.md#independent-expectations The literal full output independently expresses the generic-heritage layout at width eighty; any, KafkaRequest and its Promise union retain their type relationships.
// @evidence contracts/testing.md#distinguishing-cases This changed two-argument heritage list complements the single-argument no-op and already-broken generic-heritage no-finding twin.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderBreaksGenericHeritageTypeArgs is selected by the lint semantic-unit Evidence claim as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and applies reported edits for the literal output assertion without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderBreaksGenericHeritageTypeArgs(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "export class KafkaRequestSerializer implements Serializer<any, KafkaRequest | Promise<KafkaRequest>> {\n  serialize() {}\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "export class KafkaRequestSerializer implements Serializer<\n  any,\n  KafkaRequest | Promise<KafkaRequest>\n> {\n  serialize() {}\n}\n",
  )
}
