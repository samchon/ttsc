package evidence

import (
  "testing"
)

/**
 * Verifies the cache keeps two generations and no more.
 *
 * A resident editor session rebuilds the graph after every keystroke, so an
 * entry that is never retired would grow the process by one scan per edit for
 * as long as the session lives. Two generations keep a hit across one
 * intervening rebuild, which is what a cycle that touches a different project
 * needs, and bound the memory at twice the file set.
 *
 *  1. Scan one source and retire the generation it landed in once.
 *  2. Assert it still hits.
 *  3. Retire twice with no hit and assert it is scanned afresh.
 * @evidence contracts/testing.md#behavioral-verification newTypeScriptInventoryCache().scan is called on one parsed source and the inventory kept; after one beginCycle a second scan of the same source must return the identical pointer, and after two further beginCycle calls with no hit in between a scan must return a different pointer.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the retention contract: two generations keep a hit across one intervening rebuild (a cycle touching another project) and bound memory at twice the file set, so an entry unused for two retirements must be dropped; pointer identity distinguishes reuse from rescanning.
 * @evidence contracts/testing.md#distinguishing-cases One retirement (must survive) against two retirements without a hit (must be dropped): a cache that dropped on the first retirement fails the first check, and one that never retired fails the second.
 * @evidence contracts/testing.md#execution-ownership TestInventoryCacheKeepsTwoGenerations is a Go unit entry in the native test process; it parses in-memory TypeScript through the shim parser and drives the cache directly, with no filesystem, consumer install or product host.
 */
func TestInventoryCacheKeepsTwoGenerations(t *testing.T) {
  cache := newTypeScriptInventoryCache()
  address := populationBase{}.addressOf("src/contracts.ts")
  file := parseTestSource(t, "/repo/src/contracts.ts", "export interface IContract {}\n")

  first := cache.scan(address, file)
  cache.beginCycle()
  if survived := cache.scan(address, file); survived != first {
    t.Fatal("one retirement dropped an entry the next cycle still needed")
  }

  cache.beginCycle()
  cache.beginCycle()
  if dropped := cache.scan(address, file); dropped == first {
    t.Fatal("an entry survived two retirements without a hit")
  }
}
