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
func TestFormatDeclarationHeaderBreaksGenericHeritageTypeArgs(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "export class KafkaRequestSerializer implements Serializer<any, KafkaRequest | Promise<KafkaRequest>> {\n  serialize() {}\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "export class KafkaRequestSerializer implements Serializer<\n  any,\n  KafkaRequest | Promise<KafkaRequest>\n> {\n  serialize() {}\n}\n",
  )
}
