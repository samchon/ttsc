package evidence

import (
  "testing"
)

/**
 * Verifies a TypeScript claim root addresses a sibling source already supplied
 * by ttsc, without changing its diagnostic location.
 *
 * A monorepo package needs claim files to be selected relative to their owning
 * sibling, while a diagnostic still needs the path a developer can open from
 * the active project. Keeping the population address and display path separate
 * prevents either concern from leaking into the other.
 *
 *  1. Supply one API DTO as an explicit Program source.
 *  2. Materialize it through a `../api` TypeScript claim root.
 *  3. Assert root-relative selection and project-relative locations.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadTypeScriptInventories exercises the authored fixture. Assert root-relative selection and project-relative locations.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A monorepo package needs claim files to be selected relative to their owning sibling, while a diagnostic still needs the path a developer can open from the active project. Keeping the population address and display path separate prevents either concern from leaking into the other. The authored scenario requires this outcome: Assert root-relative selection and project-relative locations.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Supply one API DTO as an explicit Program source. Materialize it through a `../api` TypeScript claim root. Assert root-relative selection and project-relative locations.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptClaimRootMaterializesAnExplicitSiblingProgramSource runs as a Go unit entry in the native package. loadTypeScriptInventories executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptClaimRootMaterializesAnExplicitSiblingProgramSource(t *testing.T) {
  root, config, sources := rootedTypeScriptProgram(
    t,
    map[string]string{
      "packages/api/src/structures/ISale.ts": "/** @evidence docs/spec.md#sale Required contract. */\nexport interface ISale {}",
    },
    []string{"packages/api/src/structures/ISale.ts"},
    `{"claims":[{
      "type":"typescript",
      "root":"../api",
      "files":["src/structures/**/*.ts"],
      "reference":{"type":"markdown","files":["docs/**/*.md"]}
    }]}`,
  )
  inventories := loadTypeScriptInventories(root, sources, config)
  base := config.Claims[0].Base
  key := base.address("src/structures/ISale.ts")
  inventory := inventories[key]
  if inventory == nil {
    t.Fatalf("root-relative inventory %q was not materialized", key)
  }
  if inventory.Path != "../api/src/structures/ISale.ts" {
    t.Fatalf("diagnostic path = %q, want sibling project path", inventory.Path)
  }
  if len(inventory.Units) != 1 || inventory.Units[0].Target != "ISale" {
    t.Fatalf("units = %+v, want rooted DTO type", inventory.Units)
  }
  if inventory.Units[0].Path != inventory.Path ||
    len(inventory.Declarations) != 1 ||
    inventory.Declarations[0].Path != inventory.Path {
    t.Fatalf("unit and declaration locations must retain %q", inventory.Path)
  }
  if paths := matchingInventoryPaths(inventories, base, config.Claims[0].Files); len(paths) != 1 || paths[0] != key {
    t.Fatalf("claim paths = %v, want only %q", paths, key)
  }
}
