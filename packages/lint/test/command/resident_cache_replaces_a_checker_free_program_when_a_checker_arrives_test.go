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
// @evidence contracts/testing.md#behavioral-verification The resident cache replaces its checker-free Program when a later acquisition requires a checker and keeps only the checker-bearing entry.
// @evidence contracts/testing.md#independent-expectations Authored acquisition flags require distinct Program identity and checker presence; the expected single cached entry follows replacement ownership rather than another cache query.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Warm a Program through a verb that needs no checker. The asserted decision is: Assert a checker-bearing Program is returned and only it remains cached. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestResidentCacheReplacesACheckerFreeProgramWhenACheckerArrives owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestResidentCacheReplacesACheckerFreeProgramWhenACheckerArrives(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  opts := &lspCommandOptions{cwd: root, tsconfig: filepath.Join(root, "tsconfig.json")}
  cache := newResidentProgramCache()
  defer cache.invalidate()

  checkerFree, diags, _, err := cache.acquire(opts, false)
  if err != nil || checkerFree == nil || len(diags) > 0 {
    t.Fatalf("warm acquire failed: err=%v prog=%v diags=%d", err, checkerFree, len(diags))
  }
  withChecker, _, _, err := cache.acquire(opts, true)
  if err != nil || withChecker == nil {
    t.Fatalf("checker acquire failed: err=%v prog=%v", err, withChecker)
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
