package evidence

import (
  "testing"
)

/**
 * Verifies a parameter property hangs below its class like a body field.
 *
 * The shorthand has to reach the same containment scope, or a citation on the
 * class would acknowledge the fields written in the body and silently miss the
 * ones written in the constructor.
 *
 *  1. Declare one body field and one parameter property.
 *  2. Materialize the inventory.
 *  3. Assert both point at the class unit.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert both point at the class unit.
 * @evidence contracts/testing.md#independent-expectations The shorthand has to reach the same containment scope, or a citation on the class would acknowledge the fields written in the body and silently miss the ones written in the constructor. The authored scenario requires this outcome: Assert both point at the class unit.
 * @evidence contracts/testing.md#distinguishing-cases Declare one body field and one parameter property. Materialize the inventory. Assert both point at the class unit.
 * @evidence contracts/testing.md#execution-ownership TestParameterPropertyHangsBelowItsClass runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestParameterPropertyHangsBelowItsClass(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  readonly declared: number = 0;
  constructor(public readonly price: number) {}
}
`)
  byTarget := map[string]*evidenceUnit{}
  for _, unit := range inventory.Units {
    byTarget[unit.Target] = unit
  }
  class := byTarget["Sale"]
  if class == nil {
    t.Fatal("the class must materialize a unit to own its fields")
  }
  for _, target := range []string{"Sale.prototype.declared", "Sale.prototype.price"} {
    field := byTarget[target]
    if field == nil {
      t.Fatalf("%s must materialize", target)
    }
    if field.ParentID != class.ID {
      t.Fatalf(
        "%s must hang below the class, got parent %q want %q",
        target,
        field.ParentID,
        class.ID,
      )
    }
  }
}
