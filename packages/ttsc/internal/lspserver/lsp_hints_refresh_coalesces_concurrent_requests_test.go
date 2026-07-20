package lspserver

import (
  "sync"
  "testing"
  "time"
)

// TestLSPHintsRefreshCoalescesConcurrentRequests pins the scheduler that keeps
// rediscovery off the editor's hot path.
//
// One refresh costs a process spawn and a Program load per plugin, and the
// events that schedule it arrive in bursts: a multi-file save, a formatter
// rewriting several documents, a watched config change landing with them. Both
// naive answers are wrong — running one refresh per event stacks spawns behind
// each other, and dropping events while one runs leaves the corpus a generation
// behind the edit that caused it. Exactly one rerun observes the newest state
// for the cost of one refresh.
//
//  1. Hold a run open and schedule several more requests behind it.
//  2. Release it and assert exactly one rerun followed, with a newer generation.
//  3. Schedule again once idle and assert the refresher restarts.
func TestLSPHintsRefreshCoalescesConcurrentRequests(t *testing.T) {
  var refresh coalescingRefresh
  started := make(chan struct{}, 8)
  release := make(chan struct{})

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

  // A request that arrives once the refresher is idle starts a fresh run rather
  // than being swallowed by the finished one.
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
