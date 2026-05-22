package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestConfigCacheReusesEvaluationUntilContentChanges verifies loadCachedConfigFile
// memoizes a config evaluation and re-runs it only when the file content changes.
//
// Evaluating a .ts/.js lint config spawns a ttsx/node subprocess. A monorepo
// build invokes `ttsc` once per package and would otherwise re-pay that cost
// for the same shared config every time. This pins the cache: a second load of
// unchanged bytes must not call the evaluator, and an edit must invalidate
// cleanly so stale rules are never served.
//
//  1. Write a config file and load it through a call-counting evaluator.
//  2. Load it again unchanged; assert the evaluator did not run a second time.
//  3. Rewrite the file with new content and load again; assert the evaluator
//     ran and the freshly evaluated value is returned.
func TestConfigCacheReusesEvaluationUntilContentChanges(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  cfg := filepath.Join(t.TempDir(), "lint.config.ts")
  if err := os.WriteFile(cfg, []byte("// v1\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  calls := 0
  eval := func(string) (any, error) {
    calls++
    return map[string]any{"generation": float64(calls)}, nil
  }

  first, err := loadCachedConfigFile(cfg, eval)
  if err != nil {
    t.Fatalf("first load: %v", err)
  }
  if got := configCacheGeneration(first); got != 1 {
    t.Fatalf("first load: generation = %v, want 1", got)
  }

  second, err := loadCachedConfigFile(cfg, eval)
  if err != nil {
    t.Fatalf("second load: %v", err)
  }
  if calls != 1 {
    t.Fatalf("unchanged config re-evaluated: evaluator ran %d times, want 1", calls)
  }
  if got := configCacheGeneration(second); got != 1 {
    t.Fatalf("second load: generation = %v, want cached 1", got)
  }

  if err := os.WriteFile(cfg, []byte("// v2 — changed\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  third, err := loadCachedConfigFile(cfg, eval)
  if err != nil {
    t.Fatalf("third load: %v", err)
  }
  if calls != 2 {
    t.Fatalf("changed config not re-evaluated: evaluator ran %d times, want 2", calls)
  }
  if got := configCacheGeneration(third); got != 2 {
    t.Fatalf("third load: generation = %v, want 2", got)
  }
}

// configCacheGeneration reads the marker the call-counting evaluator stamps
// into its result, or -1 when the value is not the expected shape.
func configCacheGeneration(value any) float64 {
  obj, ok := value.(map[string]any)
  if !ok {
    return -1
  }
  generation, _ := obj["generation"].(float64)
  return generation
}
