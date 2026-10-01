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
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses a class with a `compute` overload set whose first signature carries `@hidden`, second `@internal` and implementation no tag; the `Sale.prototype.compute` unit must exist and its Hidden field must be `@hidden`.
 * @evidence contracts/testing.md#independent-expectations The expected value is authored from the withdrawal contract: the first tag in source order names the withdrawal, matching how a merged declaration's statement list is already read, so a diagnostic quotes the line the author sees first.
 * @evidence contracts/testing.md#distinguishing-cases Two different withdrawal tags on two declarations of one member: a last-wins rule would yield `@internal`, while a rule that dropped the member would fail the existence check.
 * @evidence contracts/testing.md#execution-ownership TestFirstWithdrawalTagInSourceOrderWins is a Go unit entry in the native test process; parseTypeScriptInventory parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
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
