package linthost

import (
  "path/filepath"
  "testing"
)

// TestResidentCacheReplacesACheckerFreeProgramWhenACheckerArrives verifies the
// one-Program-per-project invariant holds in the other arrival order too.
//
// A checker-bearing Program can serve every verb, so once one exists the
// checker-free entry for the same project is redundant. Leaving it cached would
// make the daemon's memory depend on which verb the editor happened to ask for
// first — a save before a cursor move, or the reverse.
//
//  1. Warm a Program through a verb that needs no checker.
//  2. Acquire again for a verb that does need one.
//  3. Assert a checker-bearing Program is returned and only it remains cached.
//
// @evidence contracts/testing.md#behavioral-verification The resident cache replaces its checker-free Program when a later acquisition requires a checker and keeps only the checker-bearing entry.
// @evidence contracts/testing.md#independent-expectations Authored acquisition flags require distinct Program identity and checker presence; the expected single cached entry follows replacement ownership rather than another cache query.
// @evidence contracts/testing.md#distinguishing-cases The acquisition order is checker-free first, checker-bearing second, then checker-free again: the cache must hold exactly one entry keyed as the checker-bearing Program, and the third acquisition must return that same Program. The opposite arrival order is owned by the checker-program-serves-checker-free test.
// @evidence contracts/testing.md#execution-ownership Calls residentProgramCache.acquire and invalidate directly on one temporary project; Programs are loaded in process and no daemon is started.
func TestResidentCacheReplacesACheckerFreeProgramWhenACheckerArrives(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  opts := &lspCommandOptions{cwd: root, tsconfig: filepath.Join(root, "tsconfig.json")}
  cache := newResidentProgramCache()
  defer cache.invalidate()

  checkerFree, diags, _, err := cache.acquire(opts, false)
  if err != nil || checkerFree == nil || len(diags) > 0 {
    t.Fatalf("warm acquire failed: err=%v prog=%v diags=%d", err, checkerFree, len(diags))
  }
  if checkerFree.checker != nil {
    t.Fatal("checker-free acquisition unexpectedly created a checker")
  }
  withChecker, _, _, err := cache.acquire(opts, true)
  if err != nil || withChecker == nil {
    t.Fatalf("checker acquire failed: err=%v prog=%v", err, withChecker)
  }
  if withChecker == checkerFree || withChecker.checker == nil {
    t.Fatal("checker acquisition must replace the Program and provide a checker")
  }
  if len(cache.entries) != 1 {
    t.Fatalf("cache holds %d Programs for one project, want 1", len(cache.entries))
  }
  if _, kept := cache.entries[residentProgramKey(opts, true)]; !kept {
    t.Fatal("the surviving entry is not the checker-bearing Program")
  }
  reused, _, _, err := cache.acquire(opts, false)
  if err != nil {
    t.Fatal(err)
  }
  if reused != withChecker {
    t.Fatal("a checker-free verb did not fall back to the surviving checker Program")
  }
}
