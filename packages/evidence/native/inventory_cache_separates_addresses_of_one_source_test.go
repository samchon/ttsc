package evidence

import (
  "testing"
)

/**
 * Verifies one file addressed through two roots keeps two scans.
 *
 * A unit identity carries the address it was materialized under, so the same
 * physical file selected by two differently rooted populations is two
 * inventories. Keying the cache by the source alone would hand the second
 * population the first one's addresses.
 *
 *  1. Scan one parsed source under two addresses.
 *  2. Assert the two scans are distinct.
 *  3. Assert each keeps its own address.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification typeScriptInventoryCache.scan is exercised with the scenario below; the assertions require each keeps its own address.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A unit identity carries the address it was materialized under, so the same physical file selected by two differently rooted populations is two inventories. Keying the cache by the source alone would hand the second population the first one's addresses.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Scan one parsed source under two addresses. Assert the two scans are distinct. Assert each keeps its own address.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestInventoryCacheSeparatesAddressesOfOneSource is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestInventoryCacheSeparatesAddressesOfOneSource(t *testing.T) {
  cache := newTypeScriptInventoryCache()
  file := parseTestSource(t, "/repo/src/contracts.ts", "export interface IContract {}\n")

  local := cache.scan(populationBase{}.addressOf("src/contracts.ts"), file)
  rooted := cache.scan(
    populationBase{Absolute: "/repo/api", Display: "../api"}.addressOf("src/contracts.ts"),
    file,
  )
  if local == rooted {
    t.Fatal("two addresses of one source shared a scan")
  }
  if local.Address == rooted.Address {
    t.Fatalf("both scans kept the same address %q", local.Address)
  }
}
