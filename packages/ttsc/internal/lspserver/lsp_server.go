package lspserver

import (
  "context"
  "errors"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "runtime/debug"
  "sync"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// ErrLSPUpstreamPanic wraps a panic recovered from inside an upstream
// runner. The production runner is an external tsgo process, but tests
// and embedders can still supply an in-process runner per invocation.
var ErrLSPUpstreamPanic = errors.New("ttscserver: tsgo upstream runner panicked")

// RecoverPanicAs runs fn and converts a panic into an
// ErrLSPUpstreamPanic-wrapped error. RunLSPServer uses it around the
// upstream runner seam; the recovered stack is attached for diagnostics.
//
// recover() per the Go spec catches panics but NOT runtime.Goexit, so
// a Goexit raised from inside fn runs deferred cleanup and exits its goroutine
// without returning from this helper. Hosting code that
// must turn Goexit into a typed error should run fn in a separate
// goroutine and join on a sentinel channel — outside this helper's
// scope today.
//
// @evidence contracts/common.md#principled-implementation Deferred recovery assigns the named error return, wrapping ErrLSPUpstreamPanic and formatting the recovered value plus current goroutine stack. The panic value is textual context, not a wrapped error identity; runtime.Goexit remains a nonreturning goroutine exit.
// @evidence contracts/common.md#clear-and-simple-design The helper contains panic conversion while invocation-specific runner ownership stays outside it.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Panic is surfaced through a typed error rather than discarded as a successful upstream run.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish panic recovery from Goexit, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Panic recovery is a Go runtime boundary, not a native filesystem or process representation.
// @evidence contracts/performance.md#efficient-algorithms Normal completion invokes the callback once with fixed recovery setup. Panic conversion formats its value and captures the stack through debug.Stack, which doubles its buffer until runtime.Stack fits; stack depth, formatted bytes and any custom formatting method add input-dependent work. Callback execution has no deadline here.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each callback invocation may have distinct effects and is not shared here.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The runner owner controls goroutines and native children; this helper does not acquire them.
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
// local contributions, and an upstream runner. The default upstream is the
// selected tsgo executable; an embedding can supply its own runner/validator.
//
// @evidence contracts/common.md#principled-implementation Editor transport, plugin source and invocation-scoped upstream dependency pair distinguish owned local contributions from external compiler service.
// @evidence contracts/common.md#clear-and-simple-design One invocation value supplies streams, project context and supported advertisement policy without global runner replacement.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Custom runner/validator injection uses a supported seam rather than monkey patching process globals.
// @evidence contracts/common.md#meaningful-documentation Native member prose documents nil meaning, stream closure, ignored compatibility settings and dependency-pair validation, with documentation-skill spacing.
// @evidence contracts/portability.md#os-neutral-implementation Native Cwd and absolute executable paths remain separate from io transport and protocol identifiers; runner implementations own platform execution.
// @evidenceExclude contracts/performance.md#efficient-algorithms RunLSPServer owns processing strategy rather than this options value.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The options do not coordinate sharing across sessions.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The serving operation acquires pipes and tasks; options only provide their dependencies.
type LSPServerOptions struct {
  // In is the editor-side reader; ttscserver reads JSON-RPC frames from
  // it and forwards or handles them. Shutdown attempts Close when supported,
  // ignoring its error; whether that interrupts a blocked read belongs to the
  // supplied stream's implementation.
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

  // TsgoBinary is the absolute path required by the default native runner.
  // A custom runner/validator owns its own use and admission policy.
  TsgoBinary string

  // Source contributes ttsc plugin diagnostics / code actions /
  // executeCommand handling. Nil falls back to NullPluginSource{}.
  Source PluginSource

  // SymbolProvider answers textDocument/documentSymbol and
  // textDocument/references from ttsc's compiler-backed code graph when
  // upstream tsgo does not advertise the capability; RunLSPServer does not
  // force local answers over an advertised one. Nil leaves those methods
  // forwarded to upstream tsgo.
  SymbolProvider SymbolProvider

  // SuppressExecuteCommandProvider keeps ttsc command ids out of the
  // initialize response for clients that route wrapper commands themselves.
  SuppressExecuteCommandProvider bool

  // SuppressedExecuteCommandIDs filters specific ttsc command ids out of the
  // initialize response while leaving other plugin command ids registered.
  SuppressedExecuteCommandIDs []string

  // ExecuteCommandIDPrefix namespaces advertised executeCommand ids for hosts
  // that run multiple language clients in one global command registry.
  ExecuteCommandIDPrefix string

  // ProgressDelay is accepted for CLI compatibility. The external tsgo
  // LSP command does not currently expose a progress-delay flag.
  ProgressDelay time.Duration

  // Upstream binds one runner and its validation policy to this invocation.
  // The zero value selects the production tsgo process and validates
  // TsgoBinary. Embedders supplying a Runner may also supply a Validator;
  // a nil custom Validator means the custom runner owns its prerequisites.
  // A Validator without a Runner is rejected as an incomplete dependency pair.
  Upstream LSPUpstream
}

// ErrLSPExitWithoutShutdown is returned when the editor ended the session with
// the LSP `exit` notification without a `shutdown` request before it, which
// the specification answers with exit status 1.
var ErrLSPExitWithoutShutdown = errors.New("exit notification received before a shutdown request")

// ErrLSPCwdRequired is returned when LSPServerOptions.Cwd is empty.
// ttsc surfaces a clean error here instead of starting tsgo from an
// undefined project directory.
var ErrLSPCwdRequired = errors.New("ttscserver: cwd is required")

// ErrLSPTsgoBinaryRequired is returned when no upstream tsgo executable
// path was supplied by the JavaScript launcher or native caller.
var ErrLSPTsgoBinaryRequired = errors.New("ttscserver: tsgo binary is required")

// ErrLSPUpstreamRunnerRequired is returned when an invocation supplies a
// custom upstream validator without the runner whose prerequisites it checks.
var ErrLSPUpstreamRunnerRequired = errors.New("ttscserver: custom upstream validator requires a runner")

// LSPUpstreamRunner serves one invocation through the supplied input/output.
// Embedders may provide an in-process runner; cancellation and completion belong
// to that runner rather than a global process replacement.
//
// @evidence contracts/common.md#principled-implementation Context, streams and invocation options describe one upstream execution with an explicit error result.
// @evidence contracts/common.md#clear-and-simple-design A function dependency permits hosted or native execution without another server implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported invocation injection replaces no foreign methods or global executable policy.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies embedding and cancellation responsibility, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The callable abstracts native process differences while the default runner uses executable and argv vectors.
// @evidenceExclude contracts/performance.md#efficient-algorithms The concrete runner owns its computation strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Invocation execution is not coordinated by this function type.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Concrete runners acquire and release their tasks and handles.
type LSPUpstreamRunner func(ctx context.Context, in io.Reader, out io.Writer, opts LSPServerOptions) error

// LSPUpstreamValidator checks one invocation's upstream prerequisites before
// the proxy or runner goroutines start.
//
// @evidence contracts/common.md#principled-implementation A validation error prevents runner and proxy startup for the invocation whose prerequisites were checked.
// @evidence contracts/common.md#clear-and-simple-design Validation is paired with its runner instead of applied as a global native assumption.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A custom runner may own custom prerequisites without bypassing another runner's required validation.
// @evidence contracts/common.md#meaningful-documentation Native prose states validation occurs before goroutines start, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The validator can interpret its runner's native requirements rather than imposing an executable policy on in-process hosts.
// @evidenceExclude contracts/performance.md#efficient-algorithms This function type defines validation, not its algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The serving invocation owns validation coordination.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Implementations own any temporary prerequisite probes.
type LSPUpstreamValidator func(opts LSPServerOptions) error

// LSPUpstream is the dependency pair copied by RunLSPServer for
// one invocation. Its zero value selects the production tsgo runner and
// validation policy.
//
// @evidence contracts/common.md#principled-implementation A runner and its validator form one invocation dependency; the zero pair selects the production default and a validator-only pair is invalid.
// @evidence contracts/common.md#clear-and-simple-design Copying the function pair ties admission and execution to the selected dependencies for that invocation; it does not freeze state captured by their closures or shared option fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invocation-scoped selection changes no global process hook. A custom runner owns its prerequisites when no custom validator is supplied.
// @evidence contracts/common.md#meaningful-documentation Native prose and members state copied-pair, zero-value and custom admission meaning under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native validation belongs to the native runner; the representation also supports in-process execution.
// @evidenceExclude contracts/performance.md#efficient-algorithms The captured functions choose their algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The pair coordinates no execution across invocations.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function-pair value acquires no running task or native handle; the serving operation and concrete runner own their respective resource boundaries.
type LSPUpstream struct {
  // Runner performs the invocation. Nil with a nil Validator selects the
  // default native runner; nil with a non-nil Validator is rejected.
  Runner LSPUpstreamRunner

  // Validator optionally checks the selected custom runner's prerequisites.
  // Nil for a custom Runner leaves those prerequisites with the runner.
  Validator LSPUpstreamValidator
}

// validateDefaultUpstreamOptions enforces production-only requirements
// before any process or proxy goroutine is started.
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
  observation := e2etrace.BeginCommand(cmd, "Run")
  err := cmd.Run()
  observation.Result(err)
  if err != nil {
    if ctx.Err() != nil {
      return ctx.Err()
    }
    return fmt.Errorf("tsgo --lsp --stdio: %w", err)
  }
  return nil
}

// RunLSPServer runs the selected upstream runner and byte-level proxy and waits
// for both wrapper goroutines. The default runner starts `tsgo --lsp --stdio`.
// After joining, the first non-graceful error in runner-then-proxy order wins;
// this is not completion-time ordering. Frame closure, cancellation and closed
// pipe/input errors are omitted from that selection. Once the
// editor has sent `exit`, an upstream runner failure joins that set: the
// upstream is required to terminate at that point, so its status no longer
// describes the session (see Proxy.editorRequestedExit).
//
// The lifecycle is:
//
//  1. Open two pipes around the tsgo process (editor->server, server->editor).
//  2. Spawn the upstream runner (real tsgo process or a test fake) reading/writing those pipes.
//  3. Run the proxy in parallel.
//  4. A watchdog requests closure of the pipe writers and a closeable editor
//     reader on cancellation; the runner/proxy defers close their other ends.
//     Arbitrary injected readers, writers and runners need their own exit policy.
//
// @evidence contracts/common.md#principled-implementation Invocation validation precedes pipe acquisition. The watchdog and wrapper defers request cancellation/closure, then runner and proxy errors are selected in that order after their join; editor exit discards the runner result. Exit without prior shutdown remains a distinct error only after other non-graceful errors have been considered.
// @evidence contracts/common.md#clear-and-simple-design Two pipe pairs isolate transport and one child context signals teardown. The wait group joins the runner/proxy wrappers, not every pump, watchdog or local task they may initiate.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Ignoring upstream exit status after editor exit follows the LSP lifecycle rather than hiding a failed active session.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state error folding and numbered lifecycle ownership, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The default validator requires an absolute executable and the default runner uses exec.CommandContext with separate argv and cwd. A custom runner/validator owns its native prerequisites. Editor closability and interruption depend on the injected stream; proxy editor-exit handling can return without its remaining input pump completing.
// @evidence contracts/performance.md#efficient-algorithms Fixed pipe/context/wait-group setup delegates source observer registration, runner execution and proxy frame/payload processing. Their native, JSON, text and retained-input costs still belong to this invocation; custom validators/runners and blocking streams have no time budget imposed here.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A live LSP invocation has distinct streams and effects and cannot share another invocation's pumps.
// @evidence contracts/performance.md#bound-retention-and-release-resources Pipe endpoint closure is attempted with ignored errors; the runner/proxy wrappers are joined. The watchdog, remaining editor pump, copied observers and local tasks are not independently joined. Cancellation requests source shutdown but is not a certificate of descendant termination. The default Cmd has no explicit WaitDelay and injected streams or runners can block the join indefinitely; retained session populations have no overall byte budget.
func RunLSPServer(ctx context.Context, opts LSPServerOptions) error {
  if opts.Cwd == "" {
    return ErrLSPCwdRequired
  }
  upstream := opts.Upstream
  if upstream.Runner == nil {
    if upstream.Validator != nil {
      return ErrLSPUpstreamRunnerRequired
    }
    upstream.Runner = defaultUpstreamRunner
    upstream.Validator = validateDefaultUpstreamOptions
  }
  if upstream.Validator != nil {
    if err := upstream.Validator(opts); err != nil {
      return err
    }
  }
  runner := upstream.Runner
  source := opts.Source
  if source == nil {
    source = NullPluginSource{}
  }

  upstreamInR, upstreamInW := io.Pipe()
  upstreamOutR, upstreamOutW := io.Pipe()

  proxy := NewProxy(ProxyOptions{
    EditorIn:                       opts.In,
    EditorOut:                      opts.Out,
    UpstreamIn:                     upstreamInW,
    UpstreamOut:                    upstreamOutR,
    Source:                         source,
    SuppressExecuteCommandProvider: opts.SuppressExecuteCommandProvider,
    SuppressedExecuteCommandIDs:    opts.SuppressedExecuteCommandIDs,
    ExecuteCommandIDPrefix:         opts.ExecuteCommandIDPrefix,
    SymbolProvider:                 opts.SymbolProvider,
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
      return runner(serverCtx, upstreamInR, upstreamOutW, opts)
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
  proxy.shutdownResidentPlugins()

  if proxy.editorRequestedExit() {
    // The editor asked the server to quit, so the upstream process ending is
    // the point rather than a fault. See Proxy.editorRequestedExit for why its
    // status is not a reliable signal at that moment. Proxy errors still
    // surface: those are ttsc's own.
    serverErr = nil
  }

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
    // The teardown above closes the editor input, and a read it ends reports
    // os.ErrClosed.
    if errors.Is(err, os.ErrClosed) {
      continue
    }
    return err
  }
  if proxy.editorRequestedExit() && !proxy.editorRequestedShutdown() {
    return ErrLSPExitWithoutShutdown
  }
  return nil
}

// DenyNpmInstall is kept for source compatibility with older driver
// embedders that hosted tsgo in-process. The process wrapper cannot
// override tsgo's internal ATA callback.
//
// @evidence contracts/common.md#principled-implementation This compatibility callable always returns an explicit denial error; it does not install an ATA policy into the external tsgo process.
// @evidence contracts/common.md#clear-and-simple-design A source-compatible stub preserves the old callable without pretending to own external compiler callbacks.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The documented limitation avoids monkey patching foreign ATA internals or claiming an unenforced policy.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the historical embedding API from current process-wrapper capability, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This stub does not spawn npm or interpret a native executable path.
// @evidence contracts/performance.md#efficient-algorithms The denial formats every supplied argument into a new error string, with time and temporary/output bytes growing with argument count and text length. It performs no installation or native executable discovery.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work No installation computation is performed or coordinated.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The stub acquires no retained resource.
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
