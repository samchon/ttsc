package evidence

import (
  "testing"
)

/**
 * Verifies the negative twin: a declared Markdown reference is indexed.
 *
 * Without it the complementary case is equally satisfied by a loader that indexes
 * nothing ever, which is the failure mode a pruning optimization actually
 * risks.
 *
 *  1. Place the same document in a project.
 *  2. Configure a Markdown reference selecting it.
 *  3. Assert its headings materialize.
 * @evidence contracts/testing.md#behavioral-verification loadMarkdownInventories reads the authored docs/spec.md selected by a Markdown reference. The assertions require no loader problems and exactly one inventory; they do not inspect that inventory's headings.
 * @evidence contracts/testing.md#independent-expectations Without it the complementary case is equally satisfied by a loader that indexes nothing ever, which is the failure mode a pruning optimization actually risks.
 * @evidence contracts/testing.md#distinguishing-cases One existing document is selected by the recursive Markdown glob under docs and produces one inventory. TestMarkdownIsNotIndexedWithoutAMarkdownReference supplies the zero-inventory case with the same document but no Markdown reference. Heading contents are not asserted here.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownIsIndexedWhenReferenced is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestMarkdownIsIndexedWhenReferenced(t *testing.T) {
  root := writeInventoryFixture(t, "docs/spec.md", "## Pricing {#pricing}\n")
  inventories, problems := loadMarkdownInventories(root, decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("expected no problems, got: %v", problems)
  }
  if len(inventories) != 1 {
    t.Fatalf("expected one Markdown inventory, got %d", len(inventories))
  }
}
