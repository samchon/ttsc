package evidence

import (
  "testing"
)

/**
 * Verifies a failed own population cannot prove a TypeScript claim inactive.
 *
 * Loader failure and healthy emptiness have opposite meanings for coverage.
 * A partial population may be missing the selected export, so filtering that
 * claim would hide both the direct failure and every repair signal behind it.
 *
 *  1. Mark the only matching TypeScript inventory as failed and unitless.
 *  2. Apply the activation filter to the configured claim.
 *  3. Assert the failed claim remains present for normal failure handling.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification activeGraphConfig is exercised with the scenario below; the assertions require the failed claim remains present for normal failure handling.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Loader failure and healthy emptiness have opposite meanings for coverage. A partial population may be missing the selected export, so filtering that claim would hide both the direct failure and every repair signal behind it.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Mark the only matching TypeScript inventory as failed and unitless. Apply the activation filter to the configured claim. Assert the failed claim remains present for normal failure handling.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFailedTypeScriptClaimPopulationDoesNotBecomeInactive is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestFailedTypeScriptClaimPopulationDoesNotBecomeInactive(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/claim.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  address := config.Claims[0].Base.addressOf("src/claim.ts")
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    map[string]*artifactInventory{
      address.Key: {
        Address:    address.Key,
        Path:       address.Display,
        Type:       artifactTypeScript,
        LoadFailed: true,
      },
    },
  )
  if len(active.Claims) != 1 {
    t.Fatal("a failed TypeScript population must remain active until its contents are knowable")
  }
}
