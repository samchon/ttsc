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
type Plugin interface {
  // Name is the npm-style plugin id passed to api.plugin.
  Name() string

  // Run dispatches one subcommand and returns the native CLI exit code.
  Run(invocation *PluginInvocation) int
}

// PluginInvocation owns all mutable state for one plugin call.
//
// A plugin that needs asynchronous work must register it with Go before Run
// returns. InvokePlugin waits for every registered function. Registration
// after Run returns is rejected, and writes made after the invocation closes
// return io.ErrClosedPipe. This gives child goroutines an explicit ownership
// boundary without sharing process-global output state.
type PluginInvocation struct {
  Context context.Context
  Command string
  Args    []string
  Stdout  io.Writer
  Stderr  io.Writer

  childrenMu     sync.Mutex
  children       sync.WaitGroup
  acceptingChild bool
}

// Go registers and starts invocation-owned asynchronous work. It returns false
// when Run has already returned and the ownership boundary is closed.
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
func InvokePlugin(ctx context.Context, plugin Plugin, command string, args []string) APIResult {
  if ctx == nil {
    ctx = context.Background()
  }
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
  code := plugin.Run(invocation)

  invocation.childrenMu.Lock()
  invocation.acceptingChild = false
  invocation.childrenMu.Unlock()
  invocation.children.Wait()

  stdout.close()
  stderr.close()
  return APIResult{
    Code:   code,
    Stdout: stdout.String(),
    Stderr: stderr.String(),
  }
}

// Config carries the optional registrations the host applies before binding
// globalThis[name]. Pass Config{} for a vanilla ttsc + tsgo wasm.
type Config struct {
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
