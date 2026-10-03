package lspserver

import (
  "sync"
  "testing"
  "time"
)

// TestLSPHintsRefreshCoalescesConcurrentRequests checks callback coalescing.
//
// The owned callback waits on a channel while five more requests are scheduled.
// The unit observes generations 1 and 2, no third start during a 200ms window,
// and generation 3 from a later schedule. It does not measure editor latency,
// process/Program work or refreshed corpus contents, or independently inspect
// whether the scheduler is idle before that last schedule.
//
//  1. Hold a run open and schedule several more requests behind it.
//  2. Release it and assert exactly one rerun followed, with a newer generation.
//  3. Schedule again after the quiet window and assert generation 3 arrives.
//
// @evidence contracts/testing.md#behavioral-verification Actual coalescingRefresh.schedule returns while its owned callback is blocked. Five further schedules produce observed generations [1 2], no additional start during the 200ms quiet window, and a later callback reports generation 3. The deadlines bound this unit's observation, not a universal scheduler latency or permanent absence of future work.
// @evidence contracts/testing.md#independent-expectations The run count and generation order are literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Dropping events or running one per event would produce the wrong count.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the actual package-local scheduler with owned channel callbacks and a mutex-protected generation slice. Actual goroutine scheduling runs; no directory, sidecar, compiler, process, editor or product host runs. Deferred cleanup closes admission and releases the owned blocking channel even on assertion failure; it does not assert a scheduler join or native lifecycle.
func TestLSPHintsRefreshCoalescesConcurrentRequests(t *testing.T) {
  var refresh coalescingRefresh
  started := make(chan struct{}, 8)
  release := make(chan struct{})
  defer func() {
    refresh.close();
    select {
    case <-release:
    default:
      close(release);
    }
  }()

  var mu sync.Mutex
  var generations []uint64
  task := func(generation uint64) {
    mu.Lock()
    generations = append(generations, generation)
    mu.Unlock()
    started <- struct{}{}
    <-release
  }

  refresh.schedule(task)
  waitForRefreshRun(t, started, "the first scheduled refresh never ran")
  for i := 0; i < 5; i++ {
    refresh.schedule(task)
  }
  close(release)
  waitForRefreshRun(t, started, "the coalesced requests never produced a rerun")

  // Nothing else may follow: five requests during one run are one rerun, not
  // five. A stray extra run would show up as a third start.
  select {
  case <-started:
    t.Fatal("coalesced refresh requests ran more than once")
  case <-time.After(200 * time.Millisecond):
  }

  mu.Lock()
  ran := append([]uint64(nil), generations...)
  mu.Unlock()
  if len(ran) != 2 || ran[0] != 1 || ran[1] != 2 {
    t.Fatalf("refresh generations = %v, want [1 2] — each run needs a newer stamp", ran)
  }

  // The later request must produce generation 3; idle state is not inspected.
  idle := make(chan uint64, 1)
  refresh.schedule(func(generation uint64) { idle <- generation })
  select {
  case generation := <-idle:
    if generation != 3 {
      t.Fatalf("a refresh scheduled while idle ran as generation %d, want 3", generation)
    }
  case <-time.After(5 * time.Second):
    t.Fatal("a refresh scheduled while idle never ran")
  }
}

func waitForRefreshRun(t *testing.T, started <-chan struct{}, message string) {
  t.Helper()
  select {
  case <-started:
  case <-time.After(5 * time.Second):
    t.Fatal(message)
  }
}
