package evidence

import (
  "testing"
)

/**
 * Verifies a value re-export publishes everything the declaring file does.
 *
 * The control every type-only row is measured against. Without it each of those
 * rows would also pass if the traversal had stopped reaching that module at
 * all, which is the same silence a withheld population produces.
 *
 *  1. Re-export a class, an interface, and a function by value from a barrel.
 *  2. Point a reference at the barrel alone.
 *  3. Assert the whole surface is owed.
 * @evidence contracts/testing.md#behavioral-verification assertReexportedPopulation exercises the authored fixture. Assert the whole surface is owed.
 * @evidence contracts/testing.md#independent-expectations The control every type-only row is measured against. Without it each of those rows would also pass if the traversal had stopped reaching that module at all, which is the same silence a withheld population produces. The authored scenario requires this outcome: Assert the whole surface is owed.
 * @evidence contracts/testing.md#distinguishing-cases Re-export a class, an interface, and a function by value from a barrel. Point a reference at the barrel alone. Assert the whole surface is owed.
 * @evidence contracts/testing.md#execution-ownership TestValueReexportPublishesValueSpace runs as a Go unit entry in the native package. assertReexportedPopulation executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestValueReexportPublishesValueSpace(t *testing.T) {
  assertReexportedPopulation(
    t,
    "export { Sale, IPlain, run } from \"./sale.js\";\n",
    valueReexportPopulation,
  )
}
