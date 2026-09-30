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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification normalizePrismaSet returns no documents and one rejection naming Sale.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Both schema fragments independently declare Sale.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Individually plausible files cannot duplicate model identity in one schema set.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaDuplicateModelAcrossTheSetIsRejected is one Go E2E overlay entry at tests/test-evidence/go/e2e/prisma_duplicate_model_across_the_set_is_rejected_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. normalizePrismaSet returns no documents and one rejection naming Sale. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestPrismaDuplicateModelAcrossTheSetIsRejected retains its original function body, local inputs and every assertion after transfer. normalizePrismaSet returns no documents and one rejection naming Sale. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
