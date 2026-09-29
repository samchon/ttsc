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
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported plugin boundary avoids mutating process-global stdout/stderr to capture a call.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain browser linkage and stream ownership under the documentation skill.
type Plugin interface {
  // Name is the npm-style plugin id passed to api.plugin.
  // @evidence contracts/common.md#principled-implementation Explicit registration identity decouples dispatch from the concrete plugin type.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts The implementation declares its id rather than being recognized by a consumer-specific type check.
  // @evidence contracts/common.md#meaningful-documentation The Go member comment names the API consumer under the documentation skill's context rule.
  Name() string

  // Run dispatches one subcommand and returns the native CLI exit code.
  // @evidence contracts/common.md#principled-implementation A request object supplies context, arguments and owned writers through one Go extension boundary.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Commands run through the registered implementation rather than changing a foreign global launcher.
  // @evidence contracts/common.md#meaningful-documentation The member comment states dispatch and exit-code roles under the documentation skill's clarity rule.
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
// @evidence contracts/common.md#prohibited-implementation-shortcuts Mutable buffers belong to each request, without global-stream swapping for concurrent calls.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain child registration and late-write rejection under the documentation skill.
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
// @evidence contracts/common.md#prohibited-implementation-shortcuts Late work is rejected instead of relying on a race-prone Add after Wait begins.
// @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain acceptance and task obligations under the documentation skill.
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
// @evidence contracts/common.md#principled-implementation Per-call writers and explicit child registration use Go's context, Mutex and WaitGroup ownership model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Output capture uses owned streams. Cleanup previously assumed Run returned normally; deferred finalization now owns normal and panic exits, without swallowing the panic or adding a retry wrapper.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain isolation and completion obligations under the documentation skill's ownership guidance.
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
// @evidence contracts/common.md#prohibited-implementation-shortcuts The host receives linked registrations rather than guessing installed packages from hardcoded ids.
// @evidence contracts/common.md#meaningful-documentation The native comment explains empty configuration and registration timing under the documentation skill's context rule.
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
