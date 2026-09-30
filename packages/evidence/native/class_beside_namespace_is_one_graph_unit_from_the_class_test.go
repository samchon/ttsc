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
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the type unit reports the class, and both halves contribute.
 * @evidence contracts/testing.md#independent-expectations Both halves are type units under one identity. This order is the common one, because an *instantiated* namespace above its class is `TS2434`, and the namespace here exports a value. The namespace keeps its own members, because a companion namespace beside a class is authored contract rather than the static-side machinery a function-merged namespace holds. Its twin below covers the order TypeScript does allow. The authored scenario requires this outcome: Assert the type unit reports the class, and both halves contribute.
 * @evidence contracts/testing.md#distinguishing-cases Declare a class and a value-exporting namespace of one name. Materialize the inventory. Assert the type unit reports the class, and both halves contribute.
 * @evidence contracts/testing.md#execution-ownership TestClassBesideNamespaceIsOneGraphUnitFromTheClass runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
