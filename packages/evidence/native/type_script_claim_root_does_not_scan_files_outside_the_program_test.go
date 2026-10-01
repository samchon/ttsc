package evidence

import (
  "testing"
)

/**
 * Verifies a TypeScript claim root never discovers a sibling file that ttsc did
 * not supply.
 *
 * Reading a configured directory would silently widen the compiler Program and
 * make imported files, node_modules, and filesystem contents part of Evidence
 * by accident. The tsconfig root list must remain the only admission boundary.
 *
 *  1. Write a matching DTO under the configured sibling root.
 *  2. Supply no API source in `ctx.Sources`.
 *  3. Assert the on-disk file contributes no inventory.
 * @evidence contracts/testing.md#behavioral-verification loadTypeScriptInventories exercises the authored fixture. Assert the on-disk file contributes no inventory.
 * @evidence contracts/testing.md#independent-expectations Reading a configured directory would silently widen the compiler Program and make imported files, node_modules, and filesystem contents part of Evidence by accident. The tsconfig root list must remain the only admission boundary. The authored scenario requires this outcome: Assert the on-disk file contributes no inventory.
 * @evidence contracts/testing.md#distinguishing-cases The only input is a file on disk under the claim root that matches the claim glob while the supplied source list is empty, and the expected result is an empty inventory map. The positive counterpart, where the same file is supplied as a Program source and is inventoried, is not run in this body, so a loader that returned nothing for every input would also pass.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptClaimRootDoesNotScanFilesOutsideTheProgram runs as a Go unit entry in the native package. loadTypeScriptInventories executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptClaimRootDoesNotScanFilesOutsideTheProgram(t *testing.T) {
  root, config, sources := rootedTypeScriptProgram(
    t,
    map[string]string{
      "packages/api/src/structures/ISale.ts": "export interface ISale {}",
    },
    nil,
    `{"claims":[{
      "type":"typescript",
      "root":"../api",
      "files":["src/structures/**/*.ts"],
      "reference":{"type":"markdown","files":["docs/**/*.md"]}
    }]}`,
  )
  if inventories := loadTypeScriptInventories(root, sources, config); len(inventories) != 0 {
    t.Fatalf("an on-disk source outside ctx.Sources was materialized: %v", inventories)
  }
}
