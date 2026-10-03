package evidence

import (
  "testing"
)

/**
 * Verifies a graph with no Markdown reference materializes no Markdown units.
 *
 * This pins the result, not the traversal; the pruning itself is pinned by the
 * complementary predicate cases, because a loader that walked the whole tree and then
 * filtered would satisfy this one just as well.
 *
 *  1. Place a Markdown document in a project.
 *  2. Configure a graph whose only reference is TypeScript.
 *  3. Assert no Markdown inventory materializes.
 *
 * @evidence contracts/testing.md#behavioral-verification loadMarkdownInventories is exercised with the scenario below; the assertions require no Markdown inventory materializes.
 * @evidence contracts/testing.md#independent-expectations This pins the result, not the traversal; the pruning itself is pinned by the complementary predicate cases, because a loader that walked the whole tree and then filtered would satisfy this one just as well.
 * @evidence contracts/testing.md#distinguishing-cases Place a Markdown document in a project. Configure a graph whose only reference is TypeScript. Assert no Markdown inventory materializes.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownIsNotIndexedWithoutAMarkdownReference is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestMarkdownIsNotIndexedWithoutAMarkdownReference(t *testing.T) {
  root := writeInventoryFixture(t, "docs/spec.md", "## Pricing {#pricing}\n")
  inventories, problems := loadMarkdownInventories(root, decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"typescript","files":["src/**"]}
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("expected no problems, got: %v", problems)
  }
  if len(inventories) != 0 {
    t.Fatalf("expected no Markdown inventory, got %d", len(inventories))
  }
}
