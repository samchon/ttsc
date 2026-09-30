package evidence

import (
  "testing"
)

/**
 * Verifies a type-only namespace above its class founds the merged identity.
 *
 * `TS2434` is gated on the namespace being instantiated, measured against the
 * pinned compiler: a namespace holding only types compiles clean above the
 * class it merges with, and so does any namespace in an ambient context. The
 * companion-namespace idiom this feature exists to serve is exactly that shape,
 * so "the class is always first" is not a rule the graph may lean on. Source
 * position decides, as it does for every other merge.
 *
 *  1. Declare a type-only namespace above a class of one name.
 *  2. Materialize the inventory.
 *  3. Assert the type unit reports the namespace, and the class still
 *     contributes its members below it.
 * @evidence contracts/testing.md#behavioral-verification assertMergeFoundedAtLineTwo exercises the authored fixture. Assert the type unit reports the namespace, and the class still contributes its members below it.
 * @evidence contracts/testing.md#independent-expectations `TS2434` is gated on the namespace being instantiated, measured against the pinned compiler: a namespace holding only types compiles clean above the class it merges with, and so does any namespace in an ambient context. The companion-namespace idiom this feature exists to serve is exactly that shape, so "the class is always first" is not a rule the graph may lean on. Source position decides, as it does for every other merge. The authored scenario requires this outcome: Assert the type unit reports the namespace, and the class still contributes its members below it.
 * @evidence contracts/testing.md#distinguishing-cases Declare a type-only namespace above a class of one name. Materialize the inventory. Assert the type unit reports the namespace, and the class still contributes its members below it.
 * @evidence contracts/testing.md#execution-ownership TestTypeOnlyNamespaceAboveItsClassFoundsTheIdentity runs as a Go unit entry in the native package. assertMergeFoundedAtLineTwo executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeOnlyNamespaceAboveItsClassFoundsTheIdentity(t *testing.T) {
  assertMergeFoundedAtLineTwo(t, "src/Sale.ts", `
export namespace Sale {
  export interface IProps {
    id: string;
  }
}
export class Sale {
  price: number = 0;
}
`, []string{
    "property:Sale.IProps.id",
    "property:Sale.prototype.price",
    "type:Sale",
    "type:Sale.IProps",
  }, []string{"Sale.IProps", "Sale.prototype.price"})
}
