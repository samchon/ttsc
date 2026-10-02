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
 * @evidence contracts/testing.md#distinguishing-cases One invalid schema (a multi-line @default argument) must reject; success and unreadable inputs are exercised by sibling tests, not here.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeRejectsAnInvalidSchemaWithItsLocation is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
