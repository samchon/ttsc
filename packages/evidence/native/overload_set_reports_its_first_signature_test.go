package evidence

import (
  "testing"
)

/**
 * Verifies an overload set reports its first signature.
 *
 * Overload signatures are several declarations of one identity down a different
 * collector branch than declaration merging, so the ordering rule has to hold
 * there too or a callable's diagnostics point at whichever signature happens to
 * be last.
 *
 *  1. Declare two overload signatures and their implementation.
 *  2. Materialize the inventory.
 *  3. Assert the unit's line is the first signature.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the unit's line is the first signature.
 * @evidence contracts/testing.md#independent-expectations Overload signatures are several declarations of one identity down a different collector branch than declaration merging, so the ordering rule has to hold there too or a callable's diagnostics point at whichever signature happens to be last. The authored scenario requires this outcome: Assert the unit's line is the first signature.
 * @evidence contracts/testing.md#distinguishing-cases Declare two overload signatures and their implementation. Materialize the inventory. Assert the unit's line is the first signature.
 * @evidence contracts/testing.md#execution-ownership TestOverloadSetReportsItsFirstSignature runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestOverloadSetReportsItsFirstSignature(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/format.ts", `
export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}
`)
  for _, unit := range inventory.Units {
    if unit.Target == "format" && unit.Line != 2 {
      t.Fatalf("an overload set must report its first signature at line 2, got %d", unit.Line)
    }
  }
}
