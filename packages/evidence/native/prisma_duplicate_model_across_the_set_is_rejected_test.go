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
 * @evidence contracts/testing.md#execution-ownership TestPrismaDuplicateModelAcrossTheSetIsRejected is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
