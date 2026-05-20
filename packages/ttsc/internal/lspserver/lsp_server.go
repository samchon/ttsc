package lspserver

import (
  "context"
  "errors"
  "fmt"
  "io"
  "os/exec"
  "path/filepath"
  "runtime/debug"
  "sync"
  "time"
)

// ErrLSPUpstreamPanic wraps a panic recovered from inside an upstream
// runner. The production runner is an external tsgo process, but tests
// and embedders can still install in-process runners through
// WithUpstreamRunnerForTest.
var ErrLSPUpstreamPanic = errors.New("ttscserver: tsgo upstream runner panicked")

// RecoverPanicAs runs fn and converts a panic into an
// ErrLSPUpstreamPanic-wrapped error. RunLSPServer uses it around the
// upstream runner seam; the recovered stack is attached for diagnostics.
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
// merging plugin diagnostics into the stream, and the tsgo binary that
// provides the upstream LSP server.
type LSPServerOptions struct {
  // In is the editor-side reader; ttscserver reads JSON-RPC frames from
  // it and forwards or handles them. RunLSPServer closes it on shutdown
  // if it also implements io.Closer so blocked frame reads can unblock.
  In io.Reader
  // Out is the editor-side writer; ttscserver writes both upstream
  // responses and locally-synthesized messages to it.
  Out io.Writer
  // Err is the upstream tsgo server's stderr sink. ttscserver does not
  // log to it directly.
  Err io.Writer

  // Cwd is the project root used as the upstream tsgo process working
  // directory. An empty string is rejected before any process starts.
  Cwd string
  // TsgoBinary is the absolute path to the project-selected
  // @typescript/native-preview executable.
  TsgoBinary string
  // Source contributes ttsc plugin diagnostics / code actions /
  // executeCommand handling. Nil falls back to NullPluginSource{}.
  Source PluginSource
  // ProgressDelay is accepted for CLI compatibility. The external tsgo
  // LSP command does not currently expose a progress-delay flag.
  ProgressDelay time.Duration
}

// ErrLSPCwdRequired is returned when LSPServerOptions.Cwd is empty.
// ttsc surfaces a clean error here instead of starting tsgo from an
// undefined project directory.
var ErrLSPCwdRequired = errors.New("ttscserver: cwd is required")

// ErrLSPTsgoBinaryRequired is returned when no upstream tsgo executable
// path was supplied by the JavaScript launcher or native caller.
var ErrLSPTsgoBinaryRequired = errors.New("ttscserver: tsgo binary is required")

// LSPUpstreamRunner is the seam tests use to substitute the external
// tsgo process with a controllable fake.
type LSPUpstreamRunner func(ctx context.Context, in io.Reader, out io.Writer, opts LSPServerOptions) error

// upstreamRunner is replaced in tests via WithUpstreamRunnerForTest.
var upstreamRunner LSPUpstreamRunner = defaultUpstreamRunner

// upstreamValidator checks production-only upstream requirements before any
// proxy goroutine starts. Test upstream runners replace it with a no-op.
var upstreamValidator = validateDefaultUpstreamOptions

// WithUpstreamRunnerForTest substitutes the upstream runner used by
// RunLSPServer. Returns a function the caller defers to restore the
// production runner. The seam stays in the public driver API because
// tests and embedders otherwise have no way to bypass tsgo.
func WithUpstreamRunnerForTest(runner LSPUpstreamRunner) func() {
  prev := upstreamRunner
  prevValidator := upstreamValidator
  upstreamRunner = runner
  upstreamValidator = func(LSPServerOptions) error { return nil }
  return func() {
    upstreamRunner = prev
    upstreamValidator = prevValidator
  }
}

// validateDefaultUpstreamOptions enforces production-only requirements
// before any process or proxy goroutine is started. Test upstream runners
// bypass this via WithUpstreamRunnerForTest, which replaces upstreamValidator
// with a no-op.
func validateDefaultUpstreamOptions(opts LSPServerOptions) error {
  if opts.TsgoBinary == "" {
    return ErrLSPTsgoBinaryRequired
  }
  if !filepath.IsAbs(opts.TsgoBinary) {
    return fmt.Errorf("ttscserver: tsgo binary must be absolute: %s", opts.TsgoBinary)
  }
  return nil
}

// defaultUpstreamRunner spawns `tsgo --lsp --stdio` as an external process and
// waits for it to exit. Context cancellation causes the process to be killed
// via CommandContext and the function returns ctx.Err() rather than the
// (likely "signal: killed") process error.
func defaultUpstreamRunner(ctx context.Context, in io.Reader, out io.Writer, opts LSPServerOptions) error {
  cmd := exec.CommandContext(ctx, opts.TsgoBinary, "--lsp", "--stdio")
  cmd.Dir = opts.Cwd
  cmd.Stdin = in
  cmd.Stdout = out
  cmd.Stderr = opts.Err
  if err := cmd.Run(); err != nil {
    if ctx.Err() != nil {
      return ctx.Err()
    }
    return fmt.Errorf("tsgo --lsp --stdio: %w", err)
  }
  return nil
}

// RunLSPServer starts an upstream `tsgo --lsp --stdio` process and the byte-level
// proxy, blocking until either side returns. The first non-graceful
// error wins; ErrFrameClosed and context cancellation are treated as
// clean shutdown so editor close sequences do not look like crashes.
//
// The lifecycle is:
//
//  1. Open two pipes around the tsgo process (editor->server, server->editor).
//  2. Spawn the upstream runner (real tsgo process or a test fake) reading/writing those pipes.
//  3. Run the proxy in parallel.
//  4. A watchdog cascades context cancellation by closing every pipe so both
//     halves unblock; the goroutines' own defers close the rest.
func RunLSPServer(ctx context.Context, opts LSPServerOptions) error {
  if opts.Cwd == "" {
    return ErrLSPCwdRequired
  }
  if err := upstreamValidator(opts); err != nil {
    return err
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
  // ambiguous; closing writers preserves the ErrFrameClosed signal. The
  // editor input is also closed when possible so an upstream process-start
  // failure cannot leave the editor->upstream pump blocked on stdin.
  go func() {
    <-serverCtx.Done()
    closeIfCloser(opts.In)
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
    serverErr = RecoverPanicAs(func() error {
      return upstreamRunner(serverCtx, upstreamInR, upstreamOutW, opts)
    })
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

// DenyNpmInstall is kept for source compatibility with older driver
// embedders that hosted tsgo in-process. The process wrapper cannot
// override tsgo's internal ATA callback.
func DenyNpmInstall(_ string, args []string) ([]byte, error) {
  return nil, fmt.Errorf("ttscserver: npm install disabled in LSP host (args=%v)", args)
}

// closeIfCloser closes value if it implements io.Closer. The error is
// intentionally discarded: callers invoke this only for cleanup on
// shutdown paths where the underlying stream is already going away.
func closeIfCloser(value any) {
  if closer, ok := value.(io.Closer); ok {
    _ = closer.Close()
  }
}
