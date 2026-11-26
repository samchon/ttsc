package compiler

import (
  "os"
  "sync"
  "testing"
)

// TestBeginBatchOnceHonorsMarkerAndBeginsAtMostOnce verifies the compiler
// shim's process-wide batch gate.
//
//  1. Call BeginBatchOnce with TTSC_BATCH unset and set to non-"1" values;
//     assert the underlying hook never runs and a non-nil callable no-op is
//     returned.
//  2. Call BeginBatchOnce repeatedly and concurrently with TTSC_BATCH=1;
//     assert the underlying hook runs once, every call returns its
//     programBound callback, and end is never called.
//  3. Install a hook returning nil callbacks with TTSC_BATCH=1; assert
//     BeginBatchOnce still returns a non-nil callable no-op.
//
// @evidence contracts/testing.md#behavioral-verification Exercises BeginBatchOnce with a recording stub installed on the package-level batchHook seam across unset, non-"1", repeated, concurrent and nil-callback cases.
// @evidence contracts/testing.md#independent-expectations Exact "1" marker activation, a single begin call per process, reusable programBound callback, zero end calls and non-nil no-op fallbacks come directly from the batch hook contract.
// @evidence contracts/testing.md#distinguishing-cases Unset marker, empty string, "0", "true", repeated calls with "1", concurrent goroutine calls with "1" and a nil-returning hook separate inactive, active-once, thread-safe and defensive-nil paths.
// @evidence contracts/testing.md#execution-ownership Go discovers this compiler-shim unit directly in package compiler, using t.Setenv and t.Cleanup to restore the process environment and package seam with no external process or compiler build.
func TestBeginBatchOnceHonorsMarkerAndBeginsAtMostOnce(t *testing.T) {
  t.Run("without marker returns callable noop", func(t *testing.T) {
    var beginCalls, boundCalls, endCalls int
    installBatchHookForTest(t, func() (func(), func()) {
      beginCalls++
      return func() { boundCalls++ }, func() { endCalls++ }
    })

    for _, value := range []string{"", "0", "true"} {
      t.Setenv(BatchEnv, value)
      if value == "" {
        if err := os.Unsetenv(BatchEnv); err != nil {
          t.Fatal(err)
        }
      }
      bound := BeginBatchOnce()
      if bound == nil {
        t.Fatalf("BeginBatchOnce(%q) returned nil", value)
      }
      bound()
    }
    if beginCalls != 0 || boundCalls != 0 || endCalls != 0 {
      t.Fatalf("unexpected calls without marker: begin=%d bound=%d end=%d", beginCalls, boundCalls, endCalls)
    }
  })

  t.Run("with marker begins once across repeated calls", func(t *testing.T) {
    var beginCalls, boundCalls, endCalls int
    installBatchHookForTest(t, func() (func(), func()) {
      beginCalls++
      return func() { boundCalls++ }, func() { endCalls++ }
    })
    t.Setenv(BatchEnv, "1")

    first := BeginBatchOnce()
    second := BeginBatchOnce()
    if first == nil || second == nil {
      t.Fatalf("BeginBatchOnce returned nil: first=%v second=%v", first != nil, second != nil)
    }
    first()
    second()

    if beginCalls != 1 || boundCalls != 2 || endCalls != 0 {
      t.Fatalf("repeated calls with marker: begin=%d bound=%d end=%d, want 1, 2, 0", beginCalls, boundCalls, endCalls)
    }
  })

  t.Run("with marker begins once under concurrent calls", func(t *testing.T) {
    var mu sync.Mutex
    var beginCalls, boundCalls, endCalls int
    installBatchHookForTest(t, func() (func(), func()) {
      mu.Lock()
      beginCalls++
      mu.Unlock()
      return func() {
          mu.Lock()
          boundCalls++
          mu.Unlock()
        }, func() {
          mu.Lock()
          endCalls++
          mu.Unlock()
        }
    })
    t.Setenv(BatchEnv, "1")

    const workers = 8
    var wg sync.WaitGroup
    wg.Add(workers)
    for range workers {
      go func() {
        defer wg.Done()
        BeginBatchOnce()()
      }()
    }
    wg.Wait()

    if beginCalls != 1 || boundCalls != workers || endCalls != 0 {
      t.Fatalf("concurrent calls with marker: begin=%d bound=%d end=%d, want 1, %d, 0", beginCalls, boundCalls, endCalls, workers)
    }
  })

  t.Run("nil callback from hook yields callable noop", func(t *testing.T) {
    var beginCalls int
    installBatchHookForTest(t, func() (func(), func()) {
      beginCalls++
      return nil, nil
    })
    t.Setenv(BatchEnv, "1")

    bound := BeginBatchOnce()
    if bound == nil {
      t.Fatal("BeginBatchOnce returned nil for nil hook callback")
    }
    bound()
    if beginCalls != 1 {
      t.Fatalf("beginCalls = %d, want 1", beginCalls)
    }
  })
}

func installBatchHookForTest(t *testing.T, stub func() (func(), func())) {
  t.Helper()
  batchMu.Lock()
  savedHook := batchHook
  savedStarted := batchStarted
  savedBound := batchProgramBound
  batchHook = stub
  batchStarted = false
  batchProgramBound = nil
  batchMu.Unlock()
  t.Cleanup(func() {
    batchMu.Lock()
    batchHook = savedHook
    batchStarted = savedStarted
    batchProgramBound = savedBound
    batchMu.Unlock()
  })
}
