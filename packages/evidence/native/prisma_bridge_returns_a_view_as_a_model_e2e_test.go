//go:build e2e

package evidence

import (
  "testing"
)

/**
 * Verifies the real parser returns a view among the datamodel's models.
 *
 * This decides whether a citation on a view can ever work, and the name argues
 * the other way — a view is not a table, and a reader would reasonably expect
 * it beside enums and composite types in some other slice. It does not: Prisma
 * returns it as a model, with the same fields and documentation. Pinning it
 * here is what keeps the diagnostic that lists the hostable kinds honest,
 * because that message is otherwise a claim nothing verifies.
 *
 *  1. Parse a schema declaring a model and a view.
 *  2. Assert both materialize, and that the view's column does too.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizePrismaSet materializes SaleSummary as model and total as column alongside Sale.
 * @evidence contracts/testing.md#independent-expectations The literal views fixture and expected symbol table pin Prisma's representation.
 * @evidence contracts/testing.md#distinguishing-cases A view shares model semantics while ordinary models survive.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeReturnsAViewAsAModel is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizePrismaSet (one Node run) and prismaModelUnits. It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizePrismaSet starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizePrismaSet is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts three target/symbol pairs (Sale, SaleSummary, SaleSummary.total); the id columns are not checked.
 */
func TestPrismaBridgeReturnsAViewAsAModel(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema.prisma": `datasource db {
  provider = "postgresql"
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["views"]
}

model Sale {
  id String @id @db.Uuid
}

/// A projection.
view SaleSummary {
  id    String @unique
  total Int
}
`,
  })
  result, err := normalizePrismaSet(root, []string{"prisma/schema.prisma"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 {
    t.Fatalf("expected one parsed set, got %v", result.Problems)
  }
  index := map[string]string{}
  for _, model := range result.Documents[0].Models {
    for _, unit := range prismaModelUnits(model) {
      index[unit.Target] = unit.Symbol
    }
  }
  for target, symbol := range map[string]string{
    "prisma:Sale":              "model",
    "prisma:SaleSummary":       "model",
    "prisma:SaleSummary.total": "column",
  } {
    if index[target] != symbol {
      t.Fatalf("%s materialized as %q, want %q", target, index[target], symbol)
    }
  }
}
