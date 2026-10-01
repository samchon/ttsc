//go:build e2e

package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a model declared twice across the set is Prisma's error rather than
 * a silent merge.
 *
 * A model name is unique across a schema folder, which is the whole reason a
 * target never names its file. If the two declarations were merged instead, one
 * model's members would silently join the other's obligations and the citation
 * would point at whichever file the scan reached first.
 *
 *  1. Declare the same model in two files of one set.
 *  2. Parse through the real bridge.
 *  3. Assert the set is rejected with Prisma's own message.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizePrismaSet returns no documents and one rejection naming Sale.
 * @evidence contracts/testing.md#independent-expectations Both schema fragments independently declare Sale.
 * @evidence contracts/testing.md#distinguishing-cases A duplicate model across two files of one set must reject the whole set; a duplicate within one file and distinct models across files are not run here.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDuplicateModelAcrossTheSetIsRejected is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizePrismaSet (one Node run). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizePrismaSet starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizePrismaSet is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts no documents, exactly one problem, and that the message names Sale (a substring match).
 */
func TestPrismaDuplicateModelAcrossTheSetIsRejected(t *testing.T) {
  sources := []string{"prisma/a.prisma", "prisma/b.prisma"}
  root := prismaBridgeRoot(t, map[string]string{
    sources[0]: `datasource db {
  provider = "postgresql"
}

model Sale {
  id String @id @db.Uuid
}
`,
    sources[1]: `model Sale {
  id String @id @db.Uuid
}
`,
  })
  result, err := normalizePrismaSet(root, sources)
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 0 || len(result.Problems) != 1 {
    t.Fatalf("a duplicate model must reject the set, got %d documents", len(result.Documents))
  }
  if !strings.Contains(result.Problems[0].Message, "Sale") {
    t.Fatalf("the rejection must name the duplicated model: %q", result.Problems[0].Message)
  }
}
