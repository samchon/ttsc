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
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeReturnsAViewAsAModel is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
