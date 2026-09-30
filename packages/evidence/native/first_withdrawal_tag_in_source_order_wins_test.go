package evidence

import (
  "testing"
)

/**
 * Verifies the first tag in source order names the withdrawal.
 *
 * A citation of a withdrawn target is answered by quoting the tag back, so
 * which of two competing tags wins decides which line the diagnostic sends the
 * author to. Last-wins would read identically in every other case, and this is
 * the same rule a statement list already applies to a merged declaration.
 *
 *  1. Tag two declarations of one member with different withdrawal tags.
 *  2. Collect the inventory.
 *  3. Assert the first one names the withdrawal.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the first one names the withdrawal.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A citation of a withdrawn target is answered by quoting the tag back, so which of two competing tags wins decides which line the diagnostic sends the author to. Last-wins would read identically in every other case, and this is the same rule a statement list already applies to a merged declaration. The authored scenario requires this outcome: Assert the first one names the withdrawal.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Tag two declarations of one member with different withdrawal tags. Collect the inventory. Assert the first one names the withdrawal.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFirstWithdrawalTagInSourceOrderWins runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestFirstWithdrawalTagInSourceOrderWins(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  /**
   * @hidden
   */
  compute(amount: number): void;
  /**
   * @internal
   */
  compute(amount: string): void;
  compute(amount: unknown): void {}
}
`)
  for _, unit := range inventory.Units {
    if unit.Target != "Sale.prototype.compute" {
      continue
    }
    if unit.Hidden != "@hidden" {
      t.Fatalf("the first tag must name the withdrawal, got %q", unit.Hidden)
    }
    return
  }
  t.Fatal("the withdrawn member must still materialize, marked")
}
