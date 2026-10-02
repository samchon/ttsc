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
 *
 * @evidence contracts/testing.md#behavioral-verification newTypeScriptInventoryCache().scan is called with one parsed source of `export interface IBefore {}`, which must return an inventory with one unit `IBefore` and the identical pointer on a second scan of the same source; scanning a newly parsed source of the same path with `export interface IAfter {}` must return a different inventory holding the single unit `IAfter`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the cache contract: a scan is bound to the exact parsed source object, so the same object is reused while a reparsed source (a new object, as the compiler returns after an edit) is scanned afresh and shows the new content.
 * @evidence contracts/testing.md#distinguishing-cases Same source scanned twice (pointer equality required) against an edited source of the same path (pointer inequality and new target required); a content-keyed or path-keyed cache would serve the stale unit.
 * @evidence contracts/testing.md#execution-ownership TestInventoryCacheFollowsTheParsedSource is a Go unit entry in the native test process; it parses in-memory TypeScript through the shim parser and calls the cache directly, with no filesystem, consumer install or product host.
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
