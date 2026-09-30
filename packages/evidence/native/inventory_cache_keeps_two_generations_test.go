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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification typeScriptInventoryCache.scan reuses the first inventory after one beginCycle, but must return a different inventory after two further beginCycle calls without a hit. Pointer comparisons distinguish retention from rescanning and eviction from unbounded retention.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A resident editor session rebuilds the graph after every keystroke, so an entry that is never retired would grow the process by one scan per edit for as long as the session lives. Two generations keep a hit across one intervening rebuild, which is what a cycle that touches a different project needs, and bound the memory at twice the file set.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Scan one source and retire the generation it landed in once. Assert it still hits. Retire twice with no hit and assert it is scanned afresh.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestInventoryCacheKeepsTwoGenerations is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
