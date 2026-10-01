package evidence

import (
  "testing"
)

/**
 * Verifies the real parser classifies stored columns and relation fields the
 * way this graph addresses them.
 *
 * The classification is the entire reason the parser is asked at all. A
 * back-reference such as `Seller.sales` carries no attribute in the schema
 * text, so nothing short of Prisma's own resolution can tell it from a scalar —
 * and getting it wrong would put a virtual field into a column population, or
 * drop a relation out of a relation population, with the schema perfectly
 * valid either way.
 *
 *  1. Parse a schema holding a scalar, a foreign key column, and both sides of
 *     one relation.
 *  2. Materialize its units.
 *  3. Assert each member landed in the symbol it is written as.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizePrismaSet and prismaModelUnits match the literal Sale/Seller symbol table.
 * @evidence contracts/testing.md#independent-expectations The authored schema and explicit target-symbol map specify stored columns and virtual relations.
 * @evidence contracts/testing.md#distinguishing-cases Foreign-key relation and attribute-free back-reference both remain relations.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeClassifiesColumnsAndRelations is one Go E2E entry at packages/evidence/native/prisma_bridge_classifies_columns_and_relations_test.go. It is compiled into the native package beside the actual owner, preserving access to it and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. normalizePrismaSet and prismaModelUnits match the literal Sale/Seller symbol table. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaBridgeClassifiesColumnsAndRelations retains its original function body, local inputs and every assertion after transfer. normalizePrismaSet and prismaModelUnits match the literal Sale/Seller symbol table. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestPrismaBridgeClassifiesColumnsAndRelations(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema.prisma": prismaBridgeSchema,
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
    "prisma:Sale":           "model",
    "prisma:Sale.price":     "column",
    "prisma:Sale.seller_id": "column",
    "prisma:Sale.seller":    "relation",
    "prisma:Seller":         "model",
    "prisma:Seller.sales":   "relation",
  } {
    if index[target] != symbol {
      t.Fatalf("%s materialized as %q, want %q", target, index[target], symbol)
    }
  }
}
