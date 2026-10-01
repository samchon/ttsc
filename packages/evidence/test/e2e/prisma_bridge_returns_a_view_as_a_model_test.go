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
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeReturnsAViewAsAModel is one Go E2E overlay entry at packages/evidence/test/e2e/prisma_bridge_returns_a_view_as_a_model_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. normalizePrismaSet materializes SaleSummary as model and total as column alongside Sale. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaBridgeReturnsAViewAsAModel retains its original function body, local inputs and every assertion after transfer. normalizePrismaSet materializes SaleSummary as model and total as column alongside Sale. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
