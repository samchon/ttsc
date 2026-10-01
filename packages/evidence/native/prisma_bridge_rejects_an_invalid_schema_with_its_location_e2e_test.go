//go:build e2e

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
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeRejectsAnInvalidSchemaWithItsLocation is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizePrismaSet (one Node run) and prismaContentDigest. It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizePrismaSet starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizePrismaSet is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts one problem and no documents, the schema.prisma:7 location, absence of terminal escapes, and that the problem's digest equals the native content digest.
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
