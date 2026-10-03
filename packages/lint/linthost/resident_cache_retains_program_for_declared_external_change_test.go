package linthost

import (
  "path/filepath"
  "testing"
)

// TestResidentCacheRetainsProgramForDeclaredExternalChange verifies a
// ProjectRule data edit does not discard the warm TypeScript Program.
//
// The next verb always rebuilds Engine and project-cycle state. Only the
// parsed Program and Checker remain resident when an unknown path is explicitly
// classified as external; the same unknown path without that classification
// retains the conservative full-reload behavior.
//
//  1. Warm one checker-bearing Program and apply a declared external change.
//  2. Reacquire and assert the exact Program remains resident.
//  3. Apply an undeclared unknown change and assert the cache is discarded.
//
// @evidence contracts/testing.md#behavioral-verification A declared external change preserves exact resident Program identity while an unknown undeclared change invalidates it.
// @evidence contracts/testing.md#independent-expectations The independently authored declared/unknown paths define reuse validity; identity equality and cache removal directly distinguish the two lifetime decisions.
// @evidence contracts/testing.md#distinguishing-cases The same unknown path docs/spec.md is applied twice: first with an external classification, which must leave the exact warm Program returned by the next acquisition, then without one, which must empty the cache. The classification is therefore the only variable between retention and discard; tracked TypeScript source changes are owned by other resident tests.
// @evidence contracts/testing.md#execution-ownership Calls residentProgramCache.acquire, applyChanges and invalidate directly on one temporary project; Programs are loaded in process and no daemon is started.
func TestResidentCacheRetainsProgramForDeclaredExternalChange(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  opts := &lspCommandOptions{
    cwd:      root,
    tsconfig: filepath.Join(root, "tsconfig.json"),
  }
  cache := newResidentProgramCache()
  defer cache.invalidate()

  warm, diags, _, err := cache.acquire(opts, true)
  if err != nil || warm == nil || len(diags) > 0 {
    t.Fatalf(
      "warm acquire failed: err=%v prog=%v diags=%d",
      err,
      warm,
      len(diags),
    )
  }
  external := filepath.Join(root, "docs", "spec.md")
  cache.applyChanges(
    []string{external},
    map[string]struct{}{
      canonicalProjectPath("", realProjectPath(external)): {},
    },
  )
  retained, _, _, err := cache.acquire(opts, true)
  if err != nil {
    t.Fatal(err)
  }
  if retained != warm {
    t.Fatal("declared external change discarded the warm Program")
  }

  cache.applyChanges([]string{external}, nil)
  if len(cache.entries) != 0 {
    t.Fatal("undeclared unknown change did not discard the warm Program")
  }
}
