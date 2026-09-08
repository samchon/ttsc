package evidence

import (
  "sync"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// typeScriptInventories remembers a scanned file for as long as the host keeps
// handing back the same parsed source.
//
// Scanning the Program into inventories is the single largest cost of a graph
// rebuild, and a watch cycle repeats it after every keystroke for every file —
// including the thousands the edit did not touch. The compiler already answers
// which files changed: it reuses the `*ast.SourceFile` of an unchanged file and
// produces a new one for an edited file, so the pointer is both the cheapest
// and the most exact key available. A scan can never be served for content the
// host no longer holds.
//
// This is the rule's own memory rather than host state, the same standing the
// Swagger and Prisma caches have. The mutex is there because a resident host
// may hold several projects at once.
//
// Two generations are kept. On each cycle the live generation becomes the
// previous one and a fresh live generation starts, so a lookup still hits after
// one intervening cycle while resident memory stays bounded by twice the file
// set rather than growing with the session's edit count. A resident host
// alternating between two projects pays a miss per switch; correctness does not
// depend on the hit.
var typeScriptInventories = newTypeScriptInventoryCache()

// typeScriptInventoryKey identifies one scan. Both the unit address and display
// path belong to its result. Root aliases can share unit IDs while a file has
// different project-relative paths; reusing the old path can read another file.
type typeScriptInventoryKey struct {
  address string
  display string
  file    *shimast.SourceFile
}

func newTypeScriptInventoryCache() *typeScriptInventoryCache {
  return &typeScriptInventoryCache{
    live: map[typeScriptInventoryKey]*artifactInventory{},
  }
}

type typeScriptInventoryCache struct {
  mutex    sync.Mutex
  live     map[typeScriptInventoryKey]*artifactInventory
  previous map[typeScriptInventoryKey]*artifactInventory
}

// beginCycle retires the previous generation and starts a new live one.
func (cache *typeScriptInventoryCache) beginCycle() {
  if cache == nil {
    return
  }
  cache.mutex.Lock()
  defer cache.mutex.Unlock()
  cache.previous = cache.live
  cache.live = map[typeScriptInventoryKey]*artifactInventory{}
}

// scan returns the inventory of one parsed source, scanning it only when this
// exact source has not been scanned under this address recently.
func (cache *typeScriptInventoryCache) scan(
  address artifactAddress,
  file *shimast.SourceFile,
) *artifactInventory {
  if cache == nil || file == nil {
    return scanTypeScriptInventoryAt(address, file)
  }
  key := typeScriptInventoryKey{address: address.Key, display: address.Display, file: file}
  cache.mutex.Lock()
  if inventory, hit := cache.live[key]; hit {
    cache.mutex.Unlock()
    return inventory
  }
  if inventory, hit := cache.previous[key]; hit {
    cache.live[key] = inventory
    cache.mutex.Unlock()
    return inventory
  }
  cache.mutex.Unlock()

  // Scanning happens outside the lock. Two projects that share a file may
  // scan it twice on the same cycle, which costs one redundant walk and keeps
  // an unrelated project's rebuild from waiting on this one.
  inventory := scanTypeScriptInventoryAt(address, file)
  cache.mutex.Lock()
  defer cache.mutex.Unlock()
  if existing, hit := cache.live[key]; hit {
    return existing
  }
  cache.live[key] = inventory
  return inventory
}
