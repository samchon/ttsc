package evidence

import (
  "testing"
)

/**
 * Verifies an ambient namespace above its class founds the identity too.
 *
 * The other half of the same gate, and the one that needs its own fixture. The
 * namespace here holds a **value**, which is what `TS2434` refuses everywhere
 * except an ambient context, so this order is legal for no reason the type-only
 * complementary case shares. It is written in a `.d.ts`, because that is where a
 * consumer meets it: a `package` reference reads declarations from disk.
 *
 *  1. Declare an ambient value-holding namespace above its ambient class.
 *  2. Materialize the inventory.
 *  3. Assert one unit, reported from the namespace, owning both halves.
 *
 * @evidence contracts/testing.md#behavioral-verification assertMergeFoundedAtLineTwo parses src/Sale.d.ts, where `export declare namespace Sale { const rate }` precedes `export declare class Sale { price }`, and requires exactly the units property:Sale.prototype.price, property:Sale.rate and type:Sale, the type unit reported at line 2, and both properties parented to that one Sale unit.
 * @evidence contracts/testing.md#independent-expectations The expected unit set, line 2 and the parent links are authored literals for the merge contract that the first declaration founds the identity; the namespace holds a value, which is legal above a class only in an ambient context, hence the .d.ts fixture.
 * @evidence contracts/testing.md#distinguishing-cases The ambient value-namespace-before-class order against the class-first and non-ambient type-only-namespace cases owned by sibling entries; the exact set also fails if a second Sale unit or a different kind is emitted.
 * @evidence contracts/testing.md#execution-ownership TestAmbientNamespaceAboveItsClassFoundsTheIdentity is a Go unit entry in the native test process; assertMergeFoundedAtLineTwo parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
 */
func TestAmbientNamespaceAboveItsClassFoundsTheIdentity(t *testing.T) {
  assertMergeFoundedAtLineTwo(t, "src/Sale.d.ts", `
export declare namespace Sale {
  const rate: number;
}
export declare class Sale {
  price: number;
}
`, []string{
    "property:Sale.prototype.price",
    "property:Sale.rate",
    "type:Sale",
  }, []string{"Sale.rate", "Sale.prototype.price"})
}
