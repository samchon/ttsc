package evidence

import "testing"

/**
 * Verifies an unresolvable TypeScript root is not treated as healthy emptiness.
 *
 * A missing root yields the same zero matched paths as an intentionally empty
 * population, but the failure means the absence is not evidence. Activation
 * learns this the way it learns every other broken population, from the failure
 * the claim-side pass recorded against the base — TypeScript walks nothing, so
 * typeScriptBaseProblems is what records it there. Handing this an empty map
 * would test a state the pipeline cannot produce.
 *
 *  1. Resolve a TypeScript claim against a root that does not exist.
 *  2. Materialize its claim-side population and apply activation.
 *  3. Assert the unresolvable claim remains active for diagnostic evaluation.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification typeScriptBaseProblems and activeGraphConfig exercises this case: Verifies an unresolvable TypeScript root is not treated as healthy emptiness. The original assertions check assert the unresolvable claim remains active for diagnostic evaluation.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A missing root yields the same zero matched paths as an intentionally empty population, but the failure means the absence is not evidence. Activation learns this the way it learns every other broken population, from the failure the claim-side pass recorded against the base — TypeScript walks nothing, so typeScriptBaseProblems is what records it there. Handing this an empty map would test a state the pipeline cannot produce. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Resolve a TypeScript claim against a root that does not exist. Materialize its claim-side population and apply activation. Assert the unresolvable claim remains active for diagnostic evaluation. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestUnresolvableTypeScriptClaimRootDoesNotBecomeInactive is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises typeScriptBaseProblems and activeGraphConfig within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestUnresolvableTypeScriptClaimRootDoesNotBecomeInactive(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "root":"missing-source-root",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  typescript := map[string]*artifactInventory{}
  claims := claimPopulationConfig(config, artifactTypeScript)
  if problems := typeScriptBaseProblems(claims, typescript); len(problems) != 1 {
    t.Fatalf("an unresolvable root must produce one problem, got %v", problems)
  }
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    typescript,
  )
  if len(active.Claims) != 1 {
    t.Fatal("an unresolvable TypeScript root must remain active for its root diagnostic")
  }
}
