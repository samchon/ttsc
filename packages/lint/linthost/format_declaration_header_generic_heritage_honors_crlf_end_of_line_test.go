package linthost

import "testing"

// TestFormatDeclarationHeaderGenericHeritageHonorsCRLFEndOfLine verifies the
// single-generic-heritage type-argument explode reflow synthesizes CRLF breaks
// under endOfLine:"crlf".
//
// Regression shield for issue #616 on the singleGenericHeritageHeader builder:
// it emitted a literal "\n" after `<` and per type argument, injecting lone LFs
// into a CRLF file. Bound to the CRLF oracle (LF twin: format_declaration_
// header_breaks_generic_heritage_type_args_test.go); the helper asserts zero
// lone LFs.
//
//  1. Parse a CRLF class implementing one generic type with two type arguments
//     that overflows width 80.
//  2. Apply format/declaration-header with {"endOfLine":"crlf"}.
//  3. Assert the type-argument list breaks with "\r\n" and no lone LF remains.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must break both Serializer type arguments using CRLF while preserving the generic union argument and serialize method.
// @evidence contracts/testing.md#independent-expectations The configured crlf contract and full escaped literal establish every line separator independently; the helper additionally rejects any LF lacking its CR prefix.
// @evidence contracts/testing.md#distinguishing-cases This changed CRLF generic-heritage list complements its LF positive and already-broken generic no-op, including argument-internal and closing-angle separators.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderGenericHeritageHonorsCRLFEndOfLine is selected by the lint semantic-unit Evidence claim as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and applies reported edits for the literal output assertion without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderGenericHeritageHonorsCRLFEndOfLine(t *testing.T) {
  assertFixCRLFConsistentWithOptions(
    t,
    "format/declaration-header",
    "export class KafkaRequestSerializer implements Serializer<any, KafkaRequest | Promise<KafkaRequest>> {\r\n  serialize() {}\r\n}\r\n",
    `{"printWidth":80,"tabWidth":2,"endOfLine":"crlf"}`,
    "export class KafkaRequestSerializer implements Serializer<\r\n  any,\r\n  KafkaRequest | Promise<KafkaRequest>\r\n> {\r\n  serialize() {}\r\n}\r\n",
  )
}
