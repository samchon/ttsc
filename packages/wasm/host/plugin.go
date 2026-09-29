package host

import (
  "bytes"
  "context"
  "io"
  "sync"
)

// Plugin is the in-process equivalent of ttsc's native CLI sidecar.
//
// The browser cannot spawn plugin binaries, so a consumer wasm links their Go
// adapters and registers them with Config. Every run receives invocation-owned
// streams; a plugin must write only to those streams, never os.Stdout or
// os.Stderr.
//
// @evidence contracts/common.md#principled-implementation A small Go interface supplies named command dispatch through invocation-owned streams.
// @evidence contracts/common.md#clear-and-simple-design Name identifies registration and Run owns command execution; invocation context and streams are supplied through one request rather than host-owned plugin-specific APIs.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported plugin boundary avoids mutating process-global stdout/stderr to capture a call.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain browser linkage and stream ownership under the documentation skill.
// @evidenceExclude contracts/performance.md#efficient-algorithms This interface defines command dispatch; it does not choose a command algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The extension contract does not coordinate equivalent requests or a computation cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Plugin instances implement dispatch; InvokePlugin owns the request's context, registered tasks and streams.
type Plugin interface {
  // Name is the npm-style plugin id passed to api.plugin.
  //
  // @evidence contracts/common.md#principled-implementation Explicit registration identity decouples dispatch from the concrete plugin type.
  // @evidence contracts/common.md#clear-and-simple-design One name query supplies the registry key without exposing command state or concrete plugin implementation.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The implementation declares its id rather than being recognized by a consumer-specific type check.
  // @evidence contracts/common.md#meaningful-documentation The Go member comment names the API consumer under the documentation skill's context rule.
  // @evidenceExclude contracts/performance.md#efficient-algorithms The abstract identity query specifies no processing algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work Registration identity is not a shared-computation coordinator.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Reading the registration name acquires no resource lifetime.
  Name() string

  // Run dispatches one subcommand and returns the native CLI exit code.
  //
  // @evidence contracts/common.md#principled-implementation A request object supplies context, arguments and owned writers through one Go extension boundary.
  // @evidence contracts/common.md#clear-and-simple-design One invocation groups command inputs and owned effects; command-specific parsing stays with the implementation rather than the generic host.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Commands run through the registered implementation rather than changing a foreign global launcher.
  // @evidence contracts/common.md#meaningful-documentation The member comment states dispatch and exit-code roles under the documentation skill's clarity rule.
  // @evidenceExclude contracts/performance.md#efficient-algorithms Each concrete command chooses its algorithm; this abstract signature only defines the host boundary.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work The command may have effects and this signature does not coordinate reuse of requests.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The supplied invocation and its owner govern registered task and stream lifetime; this abstract signature declares dispatch only.
  Run(invocation *PluginInvocation) int
}

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

// Config carries the optional registrations the host applies before binding
// globalThis[name]. Pass Config{} for a vanilla ttsc + tsgo wasm.
//
// @evidence contracts/common.md#principled-implementation An explicit slice of the small Plugin interface keeps linkage and registration with the consumer host.
// @evidence contracts/common.md#clear-and-simple-design One registration list is sufficient for the host factory; command options and mutable invocation state remain owned by the selected plugin call.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The host receives linked registrations rather than guessing installed packages from hardcoded ids.
// @evidence contracts/common.md#meaningful-documentation The native comment explains empty configuration and registration timing under the documentation skill's context rule.
// @evidenceExclude contracts/performance.md#efficient-algorithms The registration list is input data; Expose chooses its traversal and duplicate-check strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This configuration does not coordinate request computation or cache validity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This list describes registrations; Expose and each invocation own their retained resources.
type Config struct {
  // Plugins are registered once; empty names and nil entries are skipped.
  Plugins []Plugin
}

// invocationBuffer serializes writers owned by one invocation. Closing it
// prevents an unregistered or late goroutine from modifying a completed result.
type invocationBuffer struct {
  mu     sync.Mutex
  data   bytes.Buffer
  closed bool
}

func (buffer *invocationBuffer) Write(data []byte) (int, error) {
  buffer.mu.Lock()
  defer buffer.mu.Unlock()
  if buffer.closed {
    return 0, io.ErrClosedPipe
  }
  return buffer.data.Write(data)
}

func (buffer *invocationBuffer) String() string {
  buffer.mu.Lock()
  defer buffer.mu.Unlock()
  return buffer.data.String()
}

func (buffer *invocationBuffer) close() {
  buffer.mu.Lock()
  buffer.closed = true
  buffer.mu.Unlock()
}
