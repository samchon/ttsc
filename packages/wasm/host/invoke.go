package host

import (
  "context"
  "io"
  "sync"
)

// PluginInvocation owns all mutable state for one plugin call.
//
// A plugin that needs asynchronous work must register it with Go before Run
// returns. InvokePlugin waits for every registered function. Registration
// after Run returns is rejected, and writes made after the invocation closes
// return io.ErrClosedPipe. This gives child goroutines an explicit ownership
// boundary without sharing process-global output state.
//
// @evidence contracts/common.md#principled-implementation Context, io.Writer and synchronization primitives make request and child ownership explicit.
// @evidence contracts/common.md#clear-and-simple-design Public command inputs and writers are distinct from private registration state; Go is the single boundary that couples task acceptance with the owner's completion wait.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Mutable buffers belong to each request, without global-stream swapping for concurrent calls.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain child registration and late-write rejection under the documentation skill.
// @evidenceExclude contracts/performance.md#efficient-algorithms This owning request type groups task state and inputs; its Go and InvokePlugin operations choose the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work One effectful invocation is not a coordinator of equivalent request computations.
// @evidence contracts/performance.md#bound-retention-and-release-resources InvokePlugin acquires this request's context, copied arguments and writers. Go registers child tasks until Run exits; the owner waits for them and closes streams on normal and panic exits. Task count and captured bytes are unbounded, and children must cooperate with cancellation because the host cannot force goroutine termination.
// @evidenceExclude contracts/portability.md#os-neutral-implementation PluginInvocation holds in-memory streams and a goroutine counter and carries no native path, process or platform capability.
type PluginInvocation struct {
  // Context derives from the caller and is canceled when invocation ownership ends.
  Context context.Context

  // Command is the selected plugin subcommand.
  Command string

  // Args is the invocation-owned copy of forwarded CLI arguments.
  Args    []string

  // Stdout accepts writes until all registered work completes.
  Stdout  io.Writer

  // Stderr has the same ownership boundary as Stdout.
  Stderr  io.Writer

  childrenMu     sync.Mutex
  children       sync.WaitGroup
  acceptingChild bool
}



// Go registers and starts invocation-owned asynchronous work. It returns false
// when Run has already returned and the ownership boundary is closed.
//
// The task receives the invocation context. It must honor cancellation itself;
// registration does not supply a timeout or recover a panic in the child.
//
// @evidence contracts/common.md#principled-implementation A mutex couples acceptance and WaitGroup.Add, making child registration precede the owner's Wait.
// @evidence contracts/common.md#clear-and-simple-design One registration method keeps the acceptance check and task-count transition together, with no separate caller-managed Add/Wait protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Late work is rejected instead of relying on a race-prone Add after Wait begins.
// @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain acceptance and task obligations under the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms Registration checks acceptance and increments the WaitGroup count under one mutex in O(1), then schedules one goroutine. Task work is supplied by the plugin and is not rescanned by registration.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation registers an effectful child task; it does not determine equivalence of computations across requests.
// @evidence contracts/performance.md#bound-retention-and-release-resources Acceptance acquires one child count and goroutine; deferred Done releases the count when the task exits. Run's owner closes registration before waiting. Outstanding count is unbounded and completion depends on the task honoring its context and returning.
// @evidenceExclude contracts/portability.md#os-neutral-implementation PluginInvocation.Go starts an in-process goroutine and touches no native path or operating-system process.
func (invocation *PluginInvocation) Go(task func(context.Context)) bool {
  if task == nil {
    return false
  }
  invocation.childrenMu.Lock()
  if !invocation.acceptingChild {
    invocation.childrenMu.Unlock()
    return false
  }
  invocation.children.Add(1)
  invocation.childrenMu.Unlock()
  go func() {
    defer invocation.children.Done()
    task(invocation.Context)
  }()
  return true
}

// InvokePlugin executes one plugin call and captures its request-owned output.
// Independent invocations may run concurrently without sharing buffers.
//
// The caller's arguments are copied before dispatch. Run must return and each
// registered task must finish before the result can be captured; the context is
// propagated through an invocation-owned child context, without a deadline or
// forced goroutine stop. A panic from Run cancels that context, closes child
// registration, waits for cooperative registered work and closes its streams
// before propagating to the caller's panic handler.
//
// @evidence contracts/common.md#principled-implementation Each call copies arguments and owns synchronized writers; closing task acceptance under the same mutex as registration makes Wait safe after Run exits. Deferred finalization closes streams only after registered work finishes, including cooperative cancellation on a Run panic.
// @evidence contracts/common.md#clear-and-simple-design One invocation owns context, child registration and output finalization. The private writer enforces the same closing boundary for both streams, without a global capture mechanism or separate plugin lifecycle framework.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Owned streams replace process-global output mutation. Deferred finalization covers normal and panic exits without swallowing a panic; child tasks remain responsible for honoring context because Go cannot forcibly stop them.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain isolation and completion obligations under the documentation skill's ownership guidance.
// @evidence contracts/performance.md#efficient-algorithms Copying A argument references costs O(A); the two bytes.Buffer writers grow amortized with B captured bytes and final string capture costs O(B). Waiting tracks G registered tasks without scanning a task list. The selected plugin owns its command's algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each command owns effects and output; this executor does not coordinate equivalent request computations, and equal argument strings do not make calls shareable.
// @evidence contracts/performance.md#bound-retention-and-release-resources The call owns context, argument copy, G child tasks and B captured bytes. Deferred finalization closes registration, waits for registered work, closes both writers and cancels the context on every return/panic path. G and B have no fixed bound, and a noncooperative task can keep finalization waiting; the returned strings transfer captured output to the caller.
// @evidenceExclude contracts/portability.md#os-neutral-implementation InvokePlugin runs an in-process Plugin against in-memory buffers and starts no operating-system process and reads no native path.
func InvokePlugin(ctx context.Context, plugin Plugin, command string, args []string) (result APIResult) {
  if ctx == nil {
    ctx = context.Background()
  }
  ctx, cancel := context.WithCancel(ctx)
  stdout := &invocationBuffer{}
  stderr := &invocationBuffer{}
  invocation := &PluginInvocation{
    Context:        ctx,
    Command:        command,
    Args:           append([]string(nil), args...),
    Stdout:         stdout,
    Stderr:         stderr,
    acceptingChild: true,
  }
  code := 0
  returned := false
  defer func() {
    defer cancel()
    if !returned {
      cancel()
    }
    invocation.childrenMu.Lock()
    invocation.acceptingChild = false
    invocation.childrenMu.Unlock()
    invocation.children.Wait()
    stdout.close()
    stderr.close()
    result = APIResult{
      Code:   code,
      Stdout: stdout.String(),
      Stderr: stderr.String(),
    }
  }()
  code = plugin.Run(invocation)
  returned = true
  return
}
