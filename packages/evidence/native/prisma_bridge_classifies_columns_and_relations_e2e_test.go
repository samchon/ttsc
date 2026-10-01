//go:build e2e

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
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeClassifiesColumnsAndRelations is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizePrismaSet (one Node run) and prismaModelUnits. It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizePrismaSet starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizePrismaSet is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts exactly the six target/symbol pairs listed in its map; targets not in the map (such as the id columns) are not checked.
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
