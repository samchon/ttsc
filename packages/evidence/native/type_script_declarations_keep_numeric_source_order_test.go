package evidence

import "testing"

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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises this case: Verifies TypeScript declarations retain source order when byte offsets cross a decimal digit boundary. The original assertions check assert declaration order follows numeric source positions.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations JSDoc ranges are deduplicated through position keys. Sorting those keys as strings places offset 100 before offset 20 and makes a later duplicate appear to be the first acknowledgement in diagnostics. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Put one declaration below offset 20 and another beyond offset 100. Scan the TypeScript inventory. Assert declaration order follows numeric source positions. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptDeclarationsKeepNumericSourceOrder is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseTypeScriptInventory within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
