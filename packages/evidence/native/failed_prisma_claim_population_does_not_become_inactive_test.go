package evidence

import "testing"

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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification activeGraphConfig with an authored failed Prisma inventory exercises this case: Verifies a failed Prisma parse cannot make its claim inactive. The original assertions check assert the failed claim remains active for its direct diagnostic.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A parser failure may have hidden every selected model, so a unitless failed inventory is not evidence of a healthy empty population. Keeping the claim active preserves the parser diagnostic loaded during activation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match one Prisma claim inventory marked as parse-failed. Apply the shared own-population activation gate. Assert the failed claim remains active for its direct diagnostic. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFailedPrismaClaimPopulationDoesNotBecomeInactive is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises activeGraphConfig with an authored failed Prisma inventory within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
