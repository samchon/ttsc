package evidence

import "testing"

/**
 * Verifies Prisma claim activation follows selected healthy decoded units.
 *
 * Cold parser admission of the model-free scaffold and its first model belongs
 * to the source/transport survivors. This case owns the subsequent inventory
 * decision; it does not certify that a parser actually admitted those schemas.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls activeGraphConfig with one matching Prisma inventory for each named case. Healthy empty and hidden-only populations drop the model claim; one visible selected model and an empty failed population retain it.
 * @evidence contracts/testing.md#independent-expectations A healthy claim without a visible selected host is inactive. A selected model activates it, and failed admission cannot establish emptiness. Literal expected claim counts distinguish these contract decisions without computing them through claimIsInactive.
 * @evidence contracts/testing.md#distinguishing-cases Healthy empty versus first model preserves the native activation contribution of the scaffold/first-selected-model bridge cases. Hidden-only and failed-empty are adjacent controls against counting withdrawn hosts or concealing failed admission. Missing-reference whole-host diagnostics and parser admission remain separate source/consumer responsibilities.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedPopulationControlsActivation registers four named synchronous native subtests in one selectable Go entry. Configuration decoding and actual activeGraphConfig run in the Go test process over literal records. t.TempDir supplies the configured base identity only; no schema file, parser bridge, Node child, built artifact or product host is required. Existing bridge cases remain until actual survivor execution proves their full mapping.
 */
func TestPrismaDecodedPopulationControlsActivation(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/main.prisma"],
    "symbol":"model",
    "reference":{"type":"markdown","root":"missing-prisma-docs","files":["**/*.md"],"symbol":"h2"}
  }]}`)
  address := config.Claims[0].Base.addressOf("prisma/schema/main.prisma")
  for _, scenario := range []struct {
    name string
    units []*evidenceUnit
    failed bool
    active int
  }{
    {name: "healthy-empty", active: 0},
    {name: "first-selected-model", units: prismaModelUnits(prismaModel{Name: "target"}), active: 1},
    {name: "hidden-only", units: prismaModelUnits(prismaModel{Name: "target", Documentation: "@internal Internal bookkeeping."}), active: 0},
    {name: "failed-empty", failed: true, active: 1},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      inventories := map[string]*artifactInventory{
        address.Key: {
          Address: address.Key,
          Path: address.Display,
          Type: artifactPrisma,
          Units: scenario.units,
          LoadFailed: scenario.failed,
        },
      }
      active := activeGraphConfig(config, map[string]*artifactInventory{}, inventories, map[string]*artifactInventory{})
      if len(active.Claims) != scenario.active {
        t.Fatalf("expected %d active claim(s), got %d", scenario.active, len(active.Claims))
      }
    })
  }
}
