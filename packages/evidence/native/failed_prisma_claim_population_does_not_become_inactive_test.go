package evidence

import (
  "testing"
)

/**
 * Verifies a failed Prisma parse cannot make its claim inactive.
 *
 * A parser failure may have hidden every selected model, so a unitless failed
 * inventory is not evidence of a healthy empty population. Keeping the claim
 * active preserves the parser diagnostic loaded during activation.
 *
 *  1. Match one Prisma claim inventory marked as parse-failed.
 *  2. Apply the shared own-population activation gate.
 *  3. Assert the failed claim remains active for its direct diagnostic.
 * @evidence contracts/testing.md#behavioral-verification activeGraphConfig is exercised with the scenario below; the assertions require the failed claim remains active for its direct diagnostic.
 * @evidence contracts/testing.md#independent-expectations A parser failure may have hidden every selected model, so a unitless failed inventory is not evidence of a healthy empty population. Keeping the claim active preserves the parser diagnostic loaded during activation.
 * @evidence contracts/testing.md#distinguishing-cases Match one Prisma claim inventory marked as parse-failed. Apply the shared own-population activation gate. Assert the failed claim remains active for its direct diagnostic.
 * @evidence contracts/testing.md#execution-ownership TestFailedPrismaClaimPopulationDoesNotBecomeInactive is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestFailedPrismaClaimPopulationDoesNotBecomeInactive(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/main.prisma"],
    "symbol":"model",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  address := config.Claims[0].Base.addressOf("prisma/schema/main.prisma")
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{
      address.Key: {
        Address:    address.Key,
        Path:       address.Display,
        Type:       artifactPrisma,
        LoadFailed: true,
      },
    },
    map[string]*artifactInventory{},
  )
  if len(active.Claims) != 1 {
    t.Fatal("a parse-failed Prisma claim must remain active for its loader diagnostic")
  }
}
