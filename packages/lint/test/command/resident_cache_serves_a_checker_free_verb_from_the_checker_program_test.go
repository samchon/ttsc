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
