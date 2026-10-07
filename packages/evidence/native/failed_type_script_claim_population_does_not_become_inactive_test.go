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
 *
 * @evidence contracts/testing.md#behavioral-verification The test decodes a TypeScript claim over src/claim.ts, supplies a unitless TypeScript inventory for that address marked LoadFailed, and calls activeGraphConfig; the resulting config must still contain exactly one claim.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the activation contract: a loader failure and a healthy empty population mean opposite things for coverage, and filtering the failed claim would hide the direct failure and every repair signal.
 * @evidence contracts/testing.md#distinguishing-cases The failed-inventory case only; the Prisma form is covered by the sibling entry and the healthy-empty deactivation by other activation entries.
 * @evidence contracts/testing.md#execution-ownership TestFailedTypeScriptClaimPopulationDoesNotBecomeInactive is a Go unit entry in the native test process; it decodes an in-memory configuration and calls activeGraphConfig on constructed inventories, with no consumer install or product host.
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
