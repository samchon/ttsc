package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a schema the parser refuses comes back as a rejection that names its
 * line.
 *
 * The success payload carries no position for anything, so a rejection is the
 * one place a location survives — and it is exactly when an author needs one.
 * The colour codes Prisma writes into that report have to go, because a
 * diagnostic stream is not a terminal, while the text around them has to stay,
 * because it is the only thing that says where.
 *
 *  1. Parse a schema with an invalid field declaration.
 *  2. Assert it lands as a problem rather than an empty success.
 *  3. Assert the message names the line and carries no escape codes.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizePrismaSet returns one problem, no documents, schema.prisma:7, no terminal escapes and the content digest.
 * @evidence contracts/testing.md#independent-expectations Deliberately invalid default syntax establishes location; literal escape exclusions specify diagnostic transport.
 * @evidence contracts/testing.md#distinguishing-cases Readable rejection differs from success and unreadable inputs.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeRejectsAnInvalidSchemaWithItsLocation is one Go E2E entry at packages/evidence/native/prisma_bridge_rejects_an_invalid_schema_with_its_location_test.go. It is compiled into the native package beside the actual owner, preserving access to it and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. normalizePrismaSet returns one problem, no documents, schema.prisma:7, no terminal escapes and the content digest. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaBridgeRejectsAnInvalidSchemaWithItsLocation retains its original function body, local inputs and every assertion after transfer. normalizePrismaSet returns one problem, no documents, schema.prisma:7, no terminal escapes and the content digest. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestPrismaBridgeRejectsAnInvalidSchemaWithItsLocation(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema.prisma": `datasource db {
  provider = "postgresql"
}

model Sale {
  id String @id
  price Int @default(
    0
  )
}
`,
  })
  result, err := normalizePrismaSet(root, []string{"prisma/schema.prisma"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Problems) != 1 || len(result.Documents) != 0 {
    t.Fatalf("an invalid schema must reject, got %d documents", len(result.Documents))
  }
  message := result.Problems[0].Message
  if !strings.Contains(message, "prisma/schema.prisma:7") {
    t.Fatalf("a rejection must name the line the author has to open: %q", message)
  }
  if strings.ContainsRune(message, '\x1b') || strings.Contains(message, "[1;91m") {
    t.Fatalf("a rejection must not carry terminal escape codes: %q", message)
  }
  if result.Problems[0].Digest != prismaContentDigest(root, []string{"prisma/schema.prisma"}) {
    t.Fatal("a rejection must be attributable to the bytes that caused it")
  }
}
