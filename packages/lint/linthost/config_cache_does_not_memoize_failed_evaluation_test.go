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
// Authored failing and recovering evaluators exercise the cache policy without
// spawning a script child. Error-sentinel identity and call counts require a
// fresh attempt after each failure and reuse after successful recovery; actual
// subprocess failure and cross-process disk reuse are separate boundaries.
//
//  1. Load a config through an evaluator that always returns an error.
//  2. Load it again; assert both loads surfaced the error.
//  3. Assert the evaluator ran on both loads (the failure was not cached).
//  4. Retry successfully, then require the recovered result to be reused.
//
// @evidence contracts/testing.md#behavioral-verification loadCachedConfigFile preserves the authored evaluator error on two failed attempts, retries a successful evaluator, and then reuses that recovered result without a fourth evaluation.
// @evidence contracts/testing.md#independent-expectations An independently authored error sentinel distinguishes evaluator failure from another error; literal recovered value and call counts two and three establish retry and subsequent successful reuse.
// @evidence contracts/testing.md#distinguishing-cases Owns repeated failure, recovery on the next attempt and unchanged reuse after recovery. TestConfigCacheReusesEvaluationUntilContentChanges owns ordinary successful reuse and content invalidation.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Direct loadCachedConfigFile calls use one temporary config and authored failing/recovering evaluators in the shared Go process; returned errors, values and evaluator counts observe retry and reuse without a script child.
func TestConfigCacheDoesNotMemoizeFailedEvaluation(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  cfg := filepath.Join(t.TempDir(), "lint.config.ts")
  if err := os.WriteFile(cfg, []byte("// broken\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  calls := 0
  failure := errors.New("evaluation failed")
  eval := func(string) (any, error) {
    calls++
    return nil, failure
  }

  if _, err := loadCachedConfigFile(cfg, eval); !errors.Is(err, failure) {
    t.Fatalf("first load: expected evaluator failure, got %v", err)
  }
  if _, err := loadCachedConfigFile(cfg, eval); !errors.Is(err, failure) {
    t.Fatalf("second load: expected evaluator failure, got %v", err)
  }
  if calls != 2 {
    t.Fatalf("failed evaluation was cached: evaluator ran %d times, want 2", calls)
  }
  recover := func(string) (any, error) {
    calls++
    return "recovered", nil
  }
  for attempt := 0; attempt < 2; attempt++ {
    value, err := loadCachedConfigFile(cfg, recover)
    if err != nil || value != "recovered" {
      t.Fatalf("recovery load %d: value=%v error=%v", attempt, value, err)
    }
  }
  if calls != 3 {
    t.Fatalf("successful recovery was not reused: evaluator calls=%d, want 3", calls)
  }
}
