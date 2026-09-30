package evidence

import (
  "testing"
)

/**
 * Verifies an unresolvable TypeScript root is not treated as healthy emptiness.
 *
 * A missing root yields the same zero matched paths as an intentionally empty
 * population, but the failure means the absence is not evidence. Activation
 * learns this the way it learns every other broken population, from the failure
 * the claim-side pass recorded against the base; TypeScript walks nothing, so
 * typeScriptBaseProblems is what records it there. Handing this an empty map
 * would test a state the pipeline cannot produce.
 *
 *  1. Resolve a TypeScript claim against a root that does not exist.
 *  2. Materialize its claim-side population and apply activation.
 *  3. Assert the unresolvable claim remains active for diagnostic evaluation.
 * @evidence contracts/testing.md#behavioral-verification activeGraphConfig, typeScriptBaseProblems is exercised with the scenario below; the assertions require the unresolvable claim remains active for diagnostic evaluation.
 * @evidence contracts/testing.md#independent-expectations A missing root yields the same zero matched paths as an intentionally empty population, but the failure means the absence is not evidence. Activation learns this the way it learns every other broken population, from the failure the claim-side pass recorded against the base; TypeScript walks nothing, so typeScriptBaseProblems is what records it there. Handing this an empty map would test a state the pipeline cannot produce.
 * @evidence contracts/testing.md#distinguishing-cases Resolve a TypeScript claim against a root that does not exist. Materialize its claim-side population and apply activation. Assert the unresolvable claim remains active for diagnostic evaluation.
 * @evidence contracts/testing.md#execution-ownership TestUnresolvableTypeScriptClaimRootDoesNotBecomeInactive is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
