package linthost

import (
  "errors"
  "os"
  "path/filepath"
  "testing"
)

// TestConfigCacheDoesNotMemoizeFailedEvaluation verifies a config evaluation
// that errors is not cached, so a later load retries instead of replaying a
// stale failure.
//
// A subprocess failure — a transient ttsx crash, a dependency missing during a
// cold install — must not poison the cache: the next `ttsc` invocation should
// get a fresh attempt. loadCachedConfigFile memoizes only successful
// evaluations; this locks that the error path stores nothing.
//
//  1. Load a config through an evaluator that always returns an error.
//  2. Load it again; assert both loads surfaced the error.
//  3. Assert the evaluator ran on both loads (the failure was not cached).
func TestConfigCacheDoesNotMemoizeFailedEvaluation(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  cfg := filepath.Join(t.TempDir(), "lint.config.ts")
  if err := os.WriteFile(cfg, []byte("// broken\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  calls := 0
  eval := func(string) (any, error) {
    calls++
    return nil, errors.New("evaluation failed")
  }

  if _, err := loadCachedConfigFile(cfg, eval); err == nil {
    t.Fatal("first load: expected error, got nil")
  }
  if _, err := loadCachedConfigFile(cfg, eval); err == nil {
    t.Fatal("second load: expected error, got nil")
  }
  if calls != 2 {
    t.Fatalf("failed evaluation was cached: evaluator ran %d times, want 2", calls)
  }
}
