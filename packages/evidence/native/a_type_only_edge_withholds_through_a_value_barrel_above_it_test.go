package evidence

import (
  "testing"
)

/**
 * Verifies a type-only edge withholds through a value barrel above it.
 *
 * The mark travels rather than being read at the entry, so a value re-export of
 * a type-only re-export publishes what the inner edge allowed. Every complementary row
 * is one hop, and dropping the term that carries a nested surface's own mark
 * left the whole suite green.
 *
 *  1. Re-export type-only from an inner barrel.
 *  2. Re-export that barrel by name from the entry.
 *  3. Assert the entry publishes the type-only population.
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom runs the graph rule over src/sale.ts (class Sale, interface IPlain, function run), src/inner.ts (`export type { Sale, IPlain, run }`) and an entry src/index.ts that re-exports those names by value from inner.ts, and requires the entry's unacknowledged population to equal exactly IPlain, IPlain.rate and Sale.
 * @evidence contracts/testing.md#independent-expectations The expected list is authored: a type-only edge withholds value-space members (Sale's members and the function run) and the withholding must survive a value re-export above it, while the type-space names and the interface members remain; the list is a literal, not read back from the traversal.
 * @evidence contracts/testing.md#distinguishing-cases A two-hop barrel (type-only inner edge, value outer edge) separates a traversal that carries the mark from one that reads it only at the entry; the single-hop forms are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestATypeOnlyEdgeWithholdsThroughAValueBarrelAboveIt is a Go unit entry in the native test process; assertReexportedFrom calls runIndexRule over temp fixture files and compares the Missing-acknowledgement targets, with no consumer install or product host.
 */
func TestATypeOnlyEdgeWithholdsThroughAValueBarrelAboveIt(t *testing.T) {
  assertReexportedFrom(t, "value over type-only", map[string]string{
    "src/sale.ts":  reexportedSurface,
    "src/inner.ts": "export type { Sale, IPlain, run } from \"./sale.js\";\n",
    "src/index.ts": "export { Sale, IPlain, run } from \"./inner.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}
