package linthost

import (
  "path/filepath"
  "testing"
)

// TestResidentCacheServesACheckerFreeVerbFromTheCheckerProgram verifies a warm
// Program that has a checker also answers a verb that needs none.
//
// The cache keys on the checker flag so a checker-free Program is never handed
// to rules that read one. The reverse is safe and now matters: lsp-hints asks
// for a checker only when a hint-publishing rule needs one, so without this the
// daemon would hold a second full Program for the same project the moment a
// checker-free verb joined a checker-bearing one.
//
//  1. Warm a Program through a verb that needs a checker.
//  2. Acquire again for a verb that does not.
//  3. Assert the same Program is returned and the cache still holds one entry.
// @evidence contracts/testing.md#behavioral-verification A checker-bearing resident Program serves a later checker-free verb with the same identity and one retained cache entry.
// @evidence contracts/testing.md#independent-expectations The request capability flags establish permitted reuse independently of cache lookup output; the originally captured Program identity is the resource whose lifetime is asserted.
// @evidence contracts/testing.md#distinguishing-cases The warm acquisition asks for a checker and the second asks for none for the same project; the second must return the identical Program pointer and the cache must still hold exactly one entry, so a separate checker-free Program for the project would fail on either check. The reverse arrival order is owned by the replace-checker-free test.
// @evidence contracts/testing.md#execution-ownership Calls residentProgramCache.acquire and invalidate directly on one temporary project; Programs are loaded in process and no daemon is started.
func TestResidentCacheServesACheckerFreeVerbFromTheCheckerProgram(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  opts := &lspCommandOptions{cwd: root, tsconfig: filepath.Join(root, "tsconfig.json")}
  cache := newResidentProgramCache()
  defer cache.invalidate()

  withChecker, diags, _, err := cache.acquire(opts, true)
  if err != nil || withChecker == nil || len(diags) > 0 {
    t.Fatalf("warm acquire failed: err=%v prog=%v diags=%d", err, withChecker, len(diags))
  }
  checkerFree, _, _, err := cache.acquire(opts, false)
  if err != nil {
    t.Fatal(err)
  }
  if checkerFree != withChecker {
    t.Fatal("a checker-free verb built its own Program instead of reusing the warm one")
  }
  if len(cache.entries) != 1 {
    t.Fatalf("cache holds %d Programs for one project, want 1", len(cache.entries))
  }
}
