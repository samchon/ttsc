package evidence

import (
  "testing"
)

/**
 * Verifies TypeScript declarations retain source order when byte offsets cross
 * a decimal digit boundary.
 *
 * JSDoc ranges are deduplicated through position keys. Sorting those keys as
 * strings places offset 100 before offset 20 and makes a later duplicate appear
 * to be the first acknowledgement in diagnostics.
 *
 *  1. Put one declaration below offset 20 and another beyond offset 100.
 *  2. Scan the TypeScript inventory.
 *  3. Assert declaration order follows numeric source positions.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert declaration order follows numeric source positions.
 * @evidence contracts/testing.md#independent-expectations JSDoc ranges are deduplicated through position keys. Sorting those keys as strings places offset 100 before offset 20 and makes a later duplicate appear to be the first acknowledgement in diagnostics. The authored scenario requires this outcome: Assert declaration order follows numeric source positions.
 * @evidence contracts/testing.md#distinguishing-cases Put one declaration below offset 20 and another beyond offset 100. Scan the TypeScript inventory. Assert declaration order follows numeric source positions.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptDeclarationsKeepNumericSourceOrder runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptDeclarationsKeepNumericSourceOrder(t *testing.T) {
  inventory := parseTypeScriptInventory(
    t,
    "src/ref.ts",
    `export const pad = 1;
/** @evidence First The first declaration. */
export interface FirstRef {}










/** @evidence Second The second declaration. */
export interface SecondRef {}
`,
  )
  if len(inventory.Declarations) != 2 {
    t.Fatalf("declaration count = %d", len(inventory.Declarations))
  }
  if inventory.Declarations[0].Target != "First" ||
    inventory.Declarations[1].Target != "Second" {
    t.Fatalf(
      "declaration order = %q, %q",
      inventory.Declarations[0].Target,
      inventory.Declarations[1].Target,
    )
  }
}
