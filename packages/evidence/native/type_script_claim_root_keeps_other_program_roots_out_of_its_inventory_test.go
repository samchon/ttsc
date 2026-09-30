package evidence

import (
  "testing"
)

/**
 * Verifies a rooted claim excludes Program sources outside its declared base.
 *
 * `ctx.Sources` is necessary but not sufficient: a backend lint Program can
 * contain backend, API, and tooling roots, while the DTO claim must select only
 * the API address space. A sibling prefix must not become a broad workspace
 * scan.
 *
 *  1. Supply API, backend, and unrelated sibling files in one Program.
 *  2. Configure only the API sibling as the TypeScript claim root.
 *  3. Assert only the source contained by that exact base materializes.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadTypeScriptInventories exercises the authored fixture. Assert only the source contained by that exact base materializes.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `ctx.Sources` is necessary but not sufficient: a backend lint Program can contain backend, API, and tooling roots, while the DTO claim must select only the API address space. A sibling prefix must not become a broad workspace scan. The authored scenario requires this outcome: Assert only the source contained by that exact base materializes.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Supply API, backend, and unrelated sibling files in one Program. Configure only the API sibling as the TypeScript claim root. Assert only the source contained by that exact base materializes.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptClaimRootKeepsOtherProgramRootsOutOfItsInventory runs as a Go unit entry in the native package. loadTypeScriptInventories executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptClaimRootKeepsOtherProgramRootsOutOfItsInventory(t *testing.T) {
  root, config, sources := rootedTypeScriptProgram(
    t,
    map[string]string{
      "packages/api/src/structures/ISale.ts": "export interface ISale {}",
      "packages/backend/src/controller.ts":   "export function controller(): void {}",
      "packages/tools/src/generate.ts":       "export function generate(): void {}",
    },
    []string{
      "packages/api/src/structures/ISale.ts",
      "packages/backend/src/controller.ts",
      "packages/tools/src/generate.ts",
    },
    `{"claims":[{
      "type":"typescript",
      "root":"../api",
      "files":["src/structures/**/*.ts"],
      "reference":{"type":"markdown","files":["docs/**/*.md"]}
    }]}`,
  )
  inventories := loadTypeScriptInventories(root, sources, config)
  if len(inventories) != 1 {
    t.Fatalf("rooted inventories = %v, want one API source", inventories)
  }
  if inventories[config.Claims[0].Base.address("src/structures/ISale.ts")] == nil {
    t.Fatal("the API source was not materialized through its configured base")
  }
}
