package driver

import (
  "context"
  "errors"
  "fmt"
  "io"
  "runtime/debug"
  "sync"
  "time"

  "github.com/microsoft/typescript-go/shim/bundled"
  shimlsp "github.com/microsoft/typescript-go/shim/lsp"
  "github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

// ErrLSPUpstreamPanic wraps a panic recovered from inside the embedded
// tsgo lsp.Server. Without recovery the host process would die when
// tsgo crashed; with this wrapper the proxy can surface a typed error
// to the editor instead.
var ErrLSPUpstreamPanic = errors.New("ttscserver: embedded tsgo server panicked")

// RecoverPanicAs runs fn and converts a panic into an
// ErrLSPUpstreamPanic-wrapped error. defaultUpstreamRunner uses it and
// downstream LSP-host embeddings can opt into the same recovery
// contract; the recovered stack is attached for diagnostics.
//
// recover() per the Go spec catches panics but NOT runtime.Goexit, so
// a Goexit raised from inside fn surfaces as a clean nil return here
// (the upstream goroutine exits without an error). Hosting code that
// must turn Goexit into a typed error should run fn in a separate
// goroutine and join on a sentinel channel — outside this helper's
// scope today.
func RecoverPanicAs(fn func() error) (err error) {
  defer func() {
    if r := recover(); r != nil {
      err = fmt.Errorf("%w: %v\n%s", ErrLSPUpstreamPanic, r, debug.Stack())
    }
  }()
  return fn()
}

// LSPServerOptions wires ttscserver to its three channels of state:
// editor stdio for the LSP transport, an optional ttsc PluginSource for
// merging plugin diagnostics into the stream, and a working directory
// the embedded tsgo server treats as the project root.
type LSPServerOptions struct {
  // In is the editor-side reader; ttscserver reads JSON-RPC frames from
  // it and forwards or handles them.
  In io.Reader
  // Out is the editor-side writer; ttscserver writes both upstream
  // responses and locally-synthesized messages to it.
  Out io.Writer
  // Err is the upstream tsgo server's stderr sink. ttscserver does not
  // log to it directly.
  Err io.Writer

  // Cwd is the project root passed to tsgo's LSP. An empty string
  // panics inside tsgo, so RunLSPServer validates it up front.
  Cwd string
  // Source contributes ttsc plugin diagnostics / code actions /
  // executeCommand handling. Nil falls back to NullPluginSource{}.
  Source PluginSource
  // ProgressDelay matches tsgo's option for delaying the progress UI;
  // zero disables the delay.
  ProgressDelay time.Duration
}

// ErrLSPCwdRequired is returned when LSPServerOptions.Cwd is empty.
// ttsc surfaces a clean error here instead of letting tsgo's panic
// reach the editor.
var ErrLSPCwdRequired = errors.New("ttscserver: cwd is required")

// lspUpstreamRunner is the seam tests use to substitute the embedded
// tsgo lsp.Server with a controllable fake. Production wires it to the
// real shim-backed server.
type lspUpstreamRunner func(ctx context.Context, in io.Reader, out io.Writer, opts LSPServerOptions) error

// upstreamRunner is replaced in tests via WithUpstreamRunnerForTest.
var upstreamRunner lspUpstreamRunner = defaultUpstreamRunner

// WithUpstreamRunnerForTest substitutes the upstream runner used by
// RunLSPServer. Returns a function the caller defers to restore the
// production runner. The seam stays in the public API because tests
// live in driver_test and otherwise have no way to bypass tsgo.
func WithUpstreamRunnerForTest(runner lspUpstreamRunner) func() {
  prev := upstreamRunner
  upstreamRunner = runner
  return func() { upstreamRunner = prev }
}

func defaultUpstreamRunner(ctx context.Context, in io.Reader, out io.Writer, opts LSPServerOptions) error {
  return RecoverPanicAs(func() error {
    server := shimlsp.NewServer(&shimlsp.ServerOptions{
      In:                 shimlsp.ToReader(in),
      Out:                shimlsp.ToWriter(out),
      Err:                opts.Err,
      Cwd:                opts.Cwd,
      FS:                 DefaultFS(),
      DefaultLibraryPath: bundled.LibPath(),
      TypingsLocation:    osvfs.GetGlobalTypingsCacheLocation(),
      NpmInstall:         DenyNpmInstall,
      ProgressDelay:      opts.ProgressDelay,
    })
    return server.Run(ctx)
  })
}

// RunLSPServer starts the embedded tsgo lsp.Server and the byte-level
// proxy, blocking until either side returns. The first non-graceful
// error wins; ErrFrameClosed and context cancellation are treated as
// clean shutdown so editor close sequences do not look like crashes.
//
// The lifecycle is:
//
//  1. Open two pipes around the embedded server (editor->server, server->editor).
//  2. Spawn the upstream runner (real tsgo or a test fake) reading/writing those pipes.
//  3. Run the proxy in parallel.
//  4. A watchdog cascades context cancellation by closing every pipe so both
//     halves unblock; the goroutines' own defers close the rest.
func RunLSPServer(ctx context.Context, opts LSPServerOptions) error {
  if opts.Cwd == "" {
    return ErrLSPCwdRequired
  }
  source := opts.Source
  if source == nil {
    source = NullPluginSource{}
  }

  upstreamInR, upstreamInW := io.Pipe()
  upstreamOutR, upstreamOutW := io.Pipe()

  proxy := NewProxy(ProxyOptions{
    EditorIn:    opts.In,
    EditorOut:   opts.Out,
    UpstreamIn:  upstreamInW,
    UpstreamOut: upstreamOutR,
    Source:      source,
  })

  serverCtx, cancel := context.WithCancel(ctx)
  defer cancel()

  // Watchdog: on cancel, close the writer ends of the upstream pipes so
  // both halves unblock with a clean io.EOF. Closing readers directly
  // would surface as io.ErrClosedPipe and make ttsc's error fold
  // ambiguous; closing writers preserves the ErrFrameClosed signal.
  go func() {
    <-serverCtx.Done()
    upstreamInW.Close()
    upstreamOutW.Close()
  }()

  var wg sync.WaitGroup
  var serverErr, proxyErr error
  wg.Add(2)
  go func() {
    defer wg.Done()
    defer cancel()
    defer upstreamOutW.Close()
    defer upstreamInR.Close()
    serverErr = upstreamRunner(serverCtx, upstreamInR, upstreamOutW, opts)
  }()
  go func() {
    defer wg.Done()
    defer cancel()
    defer upstreamInW.Close()
    defer upstreamOutR.Close()
    proxyErr = proxy.Run(serverCtx)
  }()
  wg.Wait()

  for _, err := range []error{serverErr, proxyErr} {
    if err == nil {
      continue
    }
    if errors.Is(err, context.Canceled) {
      continue
    }
    if errors.Is(err, ErrFrameClosed) {
      continue
    }
    if errors.Is(err, io.ErrClosedPipe) {
      continue
    }
    return err
  }
  return nil
}

// DenyNpmInstall is the NpmInstall callback ttscserver passes to tsgo's
// LSP. ttsc has its own plugin / cache pipeline; we never want the LSP
// host running npm under the user's editor. Exposed so other LSP host
// embeddings can opt into the same behavior without copying the body.
func DenyNpmInstall(_ string, args []string) ([]byte, error) {
  return nil, fmt.Errorf("ttscserver: npm install disabled in LSP host (args=%v)", args)
}
