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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertMergeFoundedAtLineTwo exercises the authored fixture. Assert one unit, reported from the namespace, owning both halves.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The other half of the same gate, and the one that needs its own fixture. The namespace here holds a **value**, which is what `TS2434` refuses everywhere except an ambient context, so this order is legal for no reason the type-only complementary case shares. It is written in a `.d.ts`, because that is where a consumer meets it: a `package` reference reads declarations from disk. The authored scenario requires this outcome: Assert one unit, reported from the namespace, owning both halves.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare an ambient value-holding namespace above its ambient class. Materialize the inventory. Assert one unit, reported from the namespace, owning both halves.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAmbientNamespaceAboveItsClassFoundsTheIdentity runs as a Go unit entry in the native package. assertMergeFoundedAtLineTwo executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
