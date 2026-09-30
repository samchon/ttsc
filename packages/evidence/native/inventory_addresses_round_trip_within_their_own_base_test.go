package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies an inventory address round-trips inside its own base and is refused
 * by every other one.
 *
 * Composition and inversion are one contract, and both halves fail silently
 * when they disagree: an address the matcher cannot invert simply matches
 * nothing, which reads exactly like a glob that selects nothing. The default
 * base's address must also stay the bare project-relative path, because that is
 * the whole TypeScript path space as well as every unit identity written before
 * this property existed.
 *
 *  1. Compose one address under the default base and one under a declared root.
 *  2. Invert each under its own base and under the other.
 *  3. Assert each round-trips only under the base that composed it.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification populationBase address/relativeOf round-trip own entries and reject cross-base addresses.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Authored entries and literal default address specify ownership; round-trip equality alone cannot certify a shared encoding bug.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Own-base positive cases contrast with both cross-base refusals.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestInventoryAddressesRoundTripWithinTheirOwnBase is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestInventoryAddressesRoundTripWithinTheirOwnBase(t *testing.T) {
  root := filepath.Join(t.TempDir(), "packages", "backend")
  project := resolvePopulationBase(root, "")
  shared := resolvePopulationBase(root, "../../docs")

  if got := project.address("docs/spec.md"); got != "docs/spec.md" {
    t.Fatalf("default address = %q, want the bare project-relative path", got)
  }
  for _, entry := range []struct {
    base     populationBase
    relative string
  }{{project, "docs/spec.md"}, {shared, "requirements/pricing.md"}} {
    address := entry.base.address(entry.relative)
    got, owned := entry.base.relativeOf(address)
    if !owned || got != entry.relative {
      t.Fatalf("address %q did not round-trip: %q, %v", address, got, owned)
    }
  }
  if _, owned := project.relativeOf(shared.address("requirements/pricing.md")); owned {
    t.Fatal("the default base claimed an address composed for a declared root")
  }
  if _, owned := shared.relativeOf(project.address("docs/spec.md")); owned {
    t.Fatal("a declared root claimed an address composed for the default base")
  }
}
