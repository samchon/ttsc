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
 *
 * @evidence contracts/testing.md#behavioral-verification newTypeScriptInventoryCache().scan is called with one parsed source under the default base's address and under the address of a base `Absolute /repo/api, Display ../api`; the two inventories must be different pointers and must have different Address values.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the identity contract: a unit identity carries the address it was materialized under, so one physical file selected by two differently rooted populations is two inventories, and keying the cache by the source alone would hand the second population the first one's addresses.
 * @evidence contracts/testing.md#distinguishing-cases The same source object under two addresses; the same address on an edited source is covered by TestInventoryCacheFollowsTheParsedSource.
 * @evidence contracts/testing.md#execution-ownership TestInventoryCacheSeparatesAddressesOfOneSource is a Go unit entry in the native test process; it parses in-memory TypeScript through the shim parser and drives the cache directly, with no filesystem, consumer install or product host.
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
