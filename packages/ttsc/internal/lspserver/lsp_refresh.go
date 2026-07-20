package lspserver

import "sync"

// coalescingRefresh runs a background task at most once at a time, collapsing
// every request that arrives while a run is in flight into a single rerun.
//
// It exists because editor notifications arrive in bursts — a multi-file save,
// a watched-file rewrite, a settings change — while the task behind them costs a
// process spawn and a Program load. Running one per notification would stack
// those spawns; dropping the extras would leave the corpus a generation behind
// the edit that caused them. Coalescing keeps exactly one rerun, which is the
// smallest amount of work that still observes the newest state.
//
// Each run receives a strictly increasing generation so a writer can reject a
// result that a newer run has already superseded. The zero value is ready to
// use, and the task is supplied per schedule call so the owner does not have to
// wire it at construction.
type coalescingRefresh struct {
  mu         sync.Mutex
  task       func(generation uint64)
  generation uint64
  running    bool
  queued     bool
}

// schedule requests a run of task. It returns immediately: the run happens on
// its own goroutine, and a request made while a run is in flight becomes the one
// queued rerun rather than a second concurrent run.
func (r *coalescingRefresh) schedule(task func(generation uint64)) {
  if task == nil {
    return
  }
  r.mu.Lock()
  r.task = task
  if r.running {
    r.queued = true
    r.mu.Unlock()
    return
  }
  r.running = true
  r.generation++
  generation := r.generation
  r.mu.Unlock()
  go r.run(generation)
}

// run executes the task, then drains a queued request in the same goroutine so
// two cycles never overlap. Looping rather than spawning keeps the invariant the
// generation guard depends on: within one refresher, cycles are serial.
func (r *coalescingRefresh) run(generation uint64) {
  for {
    r.mu.Lock()
    task := r.task
    r.mu.Unlock()
    if task != nil {
      task(generation)
    }
    r.mu.Lock()
    if !r.queued {
      r.running = false
      r.mu.Unlock()
      return
    }
    r.queued = false
    r.generation++
    generation = r.generation
    r.mu.Unlock()
  }
}
