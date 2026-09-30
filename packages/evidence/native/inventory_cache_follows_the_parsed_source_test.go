package evidence

import (
  "testing"
)

/**
 * Verifies a cached scan is bound to the exact parsed source it came from.
 *
 * The cache exists because a watch cycle rescans thousands of files the edit
 * never touched, and it is safe only because the compiler hands back a new
 * source object for a file it reparsed. Serving a scan for content the host no
 * longer holds would report the previous edit's graph; a stale answer that
 * reads exactly like a correct one.
 *
 *  1. Scan one parsed source twice and assert the second scan is the first.
 *  2. Reparse the same path with different content.
 *  3. Assert the new source is scanned afresh and materializes the new unit.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification typeScriptInventoryCache.scan is exercised with the scenario below; the assertions require the new source is scanned afresh and materializes the new unit.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The cache exists because a watch cycle rescans thousands of files the edit never touched, and it is safe only because the compiler hands back a new source object for a file it reparsed. Serving a scan for content the host no longer holds would report the previous edit's graph; a stale answer that reads exactly like a correct one.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Scan one parsed source twice and assert the second scan is the first. Reparse the same path with different content. Assert the new source is scanned afresh and materializes the new unit.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestInventoryCacheFollowsTheParsedSource is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestInventoryCacheFollowsTheParsedSource(t *testing.T) {
  cache := newTypeScriptInventoryCache()
  address := populationBase{}.addressOf("src/contracts.ts")
  before := parseTestSource(t, "/repo/src/contracts.ts", "export interface IBefore {}\n")

  first := cache.scan(address, before)
  if first == nil || len(first.Units) != 1 || first.Units[0].Target != "IBefore" {
    t.Fatalf("the first scan did not materialize the declared unit: %+v", first)
  }
  if again := cache.scan(address, before); again != first {
    t.Fatal("the same parsed source was scanned twice instead of being reused")
  }

  after := parseTestSource(t, "/repo/src/contracts.ts", "export interface IAfter {}\n")
  edited := cache.scan(address, after)
  if edited == first {
    t.Fatal("an edited source was served the previous scan")
  }
  if len(edited.Units) != 1 || edited.Units[0].Target != "IAfter" {
    t.Fatalf("the edited source did not materialize its new unit: %+v", edited)
  }
}
