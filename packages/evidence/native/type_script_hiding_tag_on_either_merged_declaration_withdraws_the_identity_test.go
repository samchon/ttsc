package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a tag on either half of a merged identity withdraws the whole thing.
 *
 * `interface I` beside `namespace I` is one public identity and one unit, so
 * which declaration carries the comment is a matter of where the author wrote
 * it. Reading only the declaration in hand would leave the identity withdrawn
 * while its members stayed selected whenever the untagged half was written
 * first , a cascade that depended on source order.
 *
 *  1. Tag the second declaration of a merged identity and leave the first bare.
 *  2. Collect the inventory.
 *  3. Assert the identity and every member below either half are withdrawn.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the identity and every member below either half are withdrawn.
 * @evidence contracts/testing.md#independent-expectations `interface I` beside `namespace I` is one public identity and one unit, so which declaration carries the comment is a matter of where the author wrote it. Reading only the declaration in hand would leave the identity withdrawn while its members stayed selected whenever the untagged half was written first , a cascade that depended on source order. The authored scenario requires this outcome: Assert the identity and every member below either half are withdrawn.
 * @evidence contracts/testing.md#distinguishing-cases Tag the second declaration of a merged identity and leave the first bare. Collect the inventory. Assert the identity and every member below either half are withdrawn.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptHidingTagOnEitherMergedDeclarationWithdrawsTheIdentity runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptHidingTagOnEitherMergedDeclarationWithdrawsTheIdentity(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export interface ISale {
  id: string;
}

/** @internal Not part of the published surface. */
export namespace ISale {
  export interface ICreate {
    title: string;
  }
}

export interface IPublic {
  id: string;
}
`)
  for _, unit := range inventory.Units {
    withdrawn := strings.HasPrefix(unit.Target, "ISale")
    if withdrawn && unit.Hidden == "" {
      t.Fatalf("%s must be withdrawn with the identity it belongs to", unit.Target)
    }
    if !withdrawn && unit.Hidden != "" {
      t.Fatalf("%s must survive, got %q", unit.Target, unit.Hidden)
    }
  }
}
