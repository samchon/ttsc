package evidence

import (
  "testing"
)

/**
 * Verifies ambient extension coverage: every declaration-file extension
 * supported by the TypeScript artifact receives implicit namespace exports.
 *
 * The parser derives ambient context from the physical file name. Testing only
 * `.d.ts` would leave the module-specific `.d.mts` and `.d.cts` paths able to
 * regress independently.
 *
 *  1. Parse the same namespace under all declaration-file extensions.
 *  2. Collect its implicit function member.
 *  3. Assert each extension materializes the member.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert each extension materializes the member.
 * @evidence contracts/testing.md#independent-expectations The parser derives ambient context from the physical file name. Testing only `.d.ts` would leave the module-specific `.d.mts` and `.d.cts` paths able to regress independently. The authored scenario requires this outcome: Assert each extension materializes the member.
 * @evidence contracts/testing.md#distinguishing-cases Parse the same namespace under all declaration-file extensions. Collect its implicit function member. Assert each extension materializes the member.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptDeclarationFileExtensionsUseAmbientNamespaceVisibility runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptDeclarationFileExtensionsUseAmbientNamespaceVisibility(t *testing.T) {
  for _, path := range []string{
    "src/contracts.d.ts",
    "src/contracts.d.mts",
    "src/contracts.d.cts",
  } {
    t.Run(path, func(t *testing.T) {
      inventory := parseTypeScriptInventory(t, path, `
export namespace Ambient {
  function run(): void;
}
`)
      found := false
      for _, unit := range inventory.Units {
        if unit.Symbol == "function" && unit.Target == "Ambient.run" {
          found = true
        }
      }
      if !found {
        t.Fatalf("%s did not materialize Ambient.run", path)
      }
    })
  }
}
