package evidence

import (
  "testing"
)

/**
 * Verifies a class beside a namespace is one unit reported from the class.
 *
 * Both halves are type units under one identity. This order is the common one,
 * because an *instantiated* namespace above its class is `TS2434`, and the
 * namespace here exports a value. The namespace keeps its own members, because
 * a companion namespace beside a class is authored contract rather than the
 * static-side machinery a function-merged namespace holds. Its twin below
 * covers the order TypeScript does allow.
 *
 *  1. Declare a class and a value-exporting namespace of one name.
 *  2. Materialize the inventory.
 *  3. Assert the type unit reports the class, and both halves contribute.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses `export class Sale { price() }` followed by `export namespace Sale { export const version }` and the test requires a `type:Sale` unit at line 2, a `function:Sale.prototype.price` unit and a `property:Sale.version` unit.
 * @evidence contracts/testing.md#independent-expectations The expected units and line are authored from the merged-identity contract: a class beside a namespace is one type unit reported from the class, while each half still contributes its own members; line 2 is where the class is written in the fixture.
 * @evidence contracts/testing.md#distinguishing-cases The class-first order with a value-exporting namespace; the type unit's line must be the class's, and both halves' members must survive. The namespace-first ambient order is owned by a sibling entry. Only presence of these three targets is asserted, not exclusivity of the unit set.
 * @evidence contracts/testing.md#execution-ownership TestClassBesideNamespaceIsOneGraphUnitFromTheClass is a Go unit entry in the native test process; parseTypeScriptInventory parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
 */
func TestClassBesideNamespaceIsOneGraphUnitFromTheClass(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  price(): number {
    return 0;
  }
}
export namespace Sale {
  export const version: string = "1";
}
`)
  targets := map[string]int{}
  for _, unit := range inventory.Units {
    targets[unit.Symbol+":"+unit.Target] = unit.Line
  }
  if line, exists := targets["type:Sale"]; !exists || line != 2 {
    t.Fatalf("the type unit 'Sale' must be the class at line 2, got %d (exists=%v)", line, exists)
  }
  if _, exists := targets["function:Sale.prototype.price"]; !exists {
    t.Fatalf("the class must contribute its method as a separate unit, got %v", targets)
  }
  if _, exists := targets["property:Sale.version"]; !exists {
    t.Fatalf("the merged namespace must keep contributing its member, got %v", targets)
  }
}
