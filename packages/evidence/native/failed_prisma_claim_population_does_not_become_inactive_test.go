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
 * @evidence contracts/testing.md#behavioral-verification The test decodes a Prisma claim over prisma/schema/main.prisma, supplies a unitless Prisma inventory for that address marked LoadFailed, and calls activeGraphConfig; the resulting config must still contain exactly one claim.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the activation contract: a parse failure may have hidden every selected model, so a unitless failed inventory is not evidence of a healthy empty population and the claim must stay active to carry the loader's own diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases The failed-inventory case only; a healthy empty population that deactivates a claim is owned by sibling activation entries, and the TypeScript form of this rule is covered by TestFailedTypeScriptClaimPopulationDoesNotBecomeInactive.
 * @evidence contracts/testing.md#execution-ownership TestFailedPrismaClaimPopulationDoesNotBecomeInactive is a Go unit entry in the native test process; it decodes an in-memory configuration and calls activeGraphConfig on constructed inventories, with no Prisma bridge, consumer install or product host.
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
