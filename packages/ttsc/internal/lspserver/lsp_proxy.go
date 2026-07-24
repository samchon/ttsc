package lspserver

import (
  "bytes"
  "context"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "net/url"
  "os"
  "path/filepath"
  "sort"
  "strings"
  "sync"
  "sync/atomic"
  "time"
  "unicode/utf16"
  "unicode/utf8"
)

// ErrCommandNotHandled is returned by PluginSource.ExecuteCommand for commands
// ttsc does not own. The proxy asks PluginSource only for ids it advertised in
// CommandIDs; if that call still returns ErrCommandNotHandled, the advertised
// command is treated as a local command failure rather than a late upstream
// fallback.
var ErrCommandNotHandled = errors.New("lsp: command not handled by ttsc")

const (
  methodPublishDiagnostics = "textDocument/publishDiagnostics"
  methodInitialize         = "initialize"
  methodDidOpen            = "textDocument/didOpen"
  methodDidChange          = "textDocument/didChange"
  methodDidSave            = "textDocument/didSave"
  methodDidClose           = "textDocument/didClose"
  methodCodeAction         = "textDocument/codeAction"
  methodExecuteCommand     = "workspace/executeCommand"
  methodCancelRequest      = "$/cancelRequest"
  methodFormatting         = "textDocument/formatting"
  methodDocumentSymbol     = "textDocument/documentSymbol"
  methodReferences         = "textDocument/references"
  methodCompletion         = "textDocument/completion"
  methodCompletionResolve  = "completionItem/resolve"
  methodInitialized        = "initialized"
  methodExit               = "exit"

  // methodDidChangeWatchedFiles is the only notification an editor sends for a
  // file it does not have open: a tsconfig edit, a generated file, a branch
  // switch. The repository's own VS Code client registers a watcher for
  // `**/{tsconfig,jsconfig}*.json`, which its documentSelector excludes, so
  // those edits can reach ttsc through no other notification.
  methodDidChangeWatchedFiles = "workspace/didChangeWatchedFiles"
  // methodDidChangeConfiguration is the editor's own settings changing. The
  // proxy forwards it untouched and reads it only as a signal that a plugin's
  // completion corpus may have gone stale, since a rule can be enabled there.
  methodDidChangeConfiguration = "workspace/didChangeConfiguration"
  // methodLogMessage carries server-side notices to the editor's output
  // channel. The proxy uses it for state the user has to act on and no other
  // LSP message can express.
  methodLogMessage = "window/logMessage"
)

// lspMessageTypeInfo is the LSP MessageType for an informational log message.
const lspMessageTypeInfo = 3

// formatDocumentCommand is the ttsc-owned workspace command that the lint
// sidecar advertises for whole-document formatting. The textDocument/formatting
// handler routes the cached editor buffer through this command so formatOnSave
// formats the live (possibly dirty) buffer rather than the on-disk file.
const formatDocumentCommand = "ttsc.format.document"

// utf8BOM is the UTF-8 byte-order mark (U+FEFF, bytes EF BB BF). It is stripped
// from both the on-disk bytes and the editor buffer before a clean/dirty
// comparison so a BOM present on only one side does not read as an edit.
const utf8BOM = "\uFEFF"

// ProxyOptions wires the byte-level proxy together. ttscserver creates
// the upstream pipes around `tsgo --lsp --stdio` and hands the proxy
// editor stdio plus those pipe ends.
type ProxyOptions struct {
  EditorIn    io.Reader
  EditorOut   io.Writer
  UpstreamIn  io.Writer // we write here; the tsgo LSP process reads
  UpstreamOut io.Reader // the tsgo LSP process writes here; we read
  Source      PluginSource
  // SuppressExecuteCommandProvider keeps ttsc command ids out of the
  // initialize response for clients that register wrapper commands themselves.
  SuppressExecuteCommandProvider bool
  // SuppressedExecuteCommandIDs filters specific ttsc command ids out of the
  // initialize response while leaving other PluginSource command ids advertised.
  SuppressedExecuteCommandIDs []string
  // ExecuteCommandIDPrefix is prepended to advertised command ids. Hosts that
  // run multiple proxy instances in one global command registry use this to
  // avoid collisions; incoming prefixed ids are mapped back before dispatch.
  ExecuteCommandIDPrefix string
  // SymbolProvider answers textDocument/documentSymbol and
  // textDocument/references from ttsc's compiler-backed code graph. tsgo
  // implements both methods, so the proxy forwards to tsgo whenever it
  // advertises the capability and consults this provider only as a fallback
  // (tsgo did not advertise) or when ForceLocalSymbolProvider is set. Nil leaves
  // both methods forwarded to tsgo unconditionally.
  SymbolProvider SymbolProvider
  // ForceLocalSymbolProvider answers documentSymbol/references from
  // SymbolProvider even when upstream tsgo advertises the capability. It serves
  // a raw-LSP graph consumer (such as @samchon/graph) that wants graph-derived
  // declarations and usages instead of tsgo's language-service answers. Ignored
  // when SymbolProvider is nil.
  ForceLocalSymbolProvider bool
}

// Proxy bridges the editor and an upstream tsgo LSP process, intercepting
// the message types ttsc cares about (publishDiagnostics merge, code
// action augmentation, executeCommand for ttsc-owned commands).
type Proxy struct {
  editorIn                       io.Reader
  editorOut                      io.Writer
  upstreamIn                     io.Writer
  upstreamOut                    io.Reader
  source                         PluginSource
  suppressExecuteCommandProvider bool
  suppressedExecuteCommandIDs    map[string]struct{}
  executeCommandIDPrefix         string
  symbolProvider                 SymbolProvider
  forceLocalSymbolProvider       bool

  writeMu         sync.Mutex // serializes WriteFrame calls to editorOut
  upstreamWriteMu sync.Mutex // serializes writes to upstreamIn
  asyncErrCh      chan error

  // editorExit records that the editor sent the LSP `exit` notification.
  // RunLSPServer reads it to decide whether a failed upstream process is a
  // fault to report or the expected end of an editor-requested shutdown; see
  // editorRequestedExit.
  editorExit atomic.Bool

  pendingMu      sync.Mutex
  pendingActions map[string]pendingCodeActionRequest
  // pendingCompletions holds the plugin items computed for a forwarded
  // completion request, keyed by request id, until upstream answers it.
  pendingCompletions       map[string]pendingCompletionRequest
  pendingAugmentingActions map[string]struct{}
  pendingLocalActions      map[string]struct{}
  pendingCommands          map[string]struct{}
  pendingClientRequests    map[string]func(Envelope)
  pendingInitialize        map[string]struct{}
  clientRequestSequence    atomic.Uint64

  capabilityMu                   sync.Mutex
  upstreamCodeActionProvider     bool
  upstreamDocumentSymbolProvider bool
  upstreamReferencesProvider     bool
  // initializeAnswered records that the editor has received the augmented
  // capabilities, which is what makes a later trigger character "late".
  initializeAnswered bool
  // advertisedCompletionTriggers is the trigger set the editor was told about:
  // tsgo's own characters plus whatever the corpus contributed at that moment.
  // A refresh that produces a trigger outside this set cannot reach the editor
  // without a restart, so the proxy says so once per character.
  advertisedCompletionTriggers map[string]struct{}
  reportedCompletionTriggers   map[string]struct{}
  projectInputWatchDynamic     bool
  projectInputWatchRelative    bool

  diagnosticsMu               sync.Mutex
  upstreamDiagnostics         map[string]cachedDiagnostics
  pluginDiagnostics           map[string]cachedDiagnostics
  projectDiagnostics          cachedDiagnostics
  projectDiagnosticsURI       string
  projectDiagnosticGeneration uint64
  diagnosticGeneration        map[string]uint64
  documentGeneration          map[string]uint64
  dirtyDocuments              map[string]struct{}
  dirtyVersions               map[string]*int
  // documentText caches the live editor buffer per uri so the
  // textDocument/formatting handler can format the in-memory text instead
  // of the on-disk file. didOpen / full-sync didChange seed it with the full
  // text, and incremental (ranged) didChange splices each edit into the
  // cached text so it tracks the live buffer (see cacheDidChangeText).
  // didClose evicts the entry; a ranged change with no cached base, or a
  // position the proxy cannot map, also drops the entry so the formatting
  // handler falls back to a disk read. Guarded by diagnosticsMu like the
  // other per-uri document state.
  documentText map[string]string

  projectRefreshMu                   sync.Mutex
  projectRefreshTimer                *time.Timer
  projectDiagnosticsRefresh          coalescingRefresh
  pendingProjectDiagnosticGeneration uint64
  projectDiagnosticRefreshPending    bool
  pendingProjectDiagnosticAllOwners  bool
  pendingProjectDiagnosticOwners     map[string]struct{}

  projectInputWatchMu                     sync.Mutex
  projectInputWatchReady                  bool
  projectInputWatchDesired                projectInputWatchRegistration
  projectInputWatchActive                 projectInputWatchRegistration
  projectInputWatchStaleIDs               []string
  projectInputWatchPending                bool
  projectInputWatchFailedSignature        string
  projectInputWatchUnregisterRetryBlocked bool
  projectInputWatchWarningSent            bool
  projectInputWatchRegistrationSequence   uint64
}

type pendingCodeActionRequest struct {
  uri        string
  rng        LSPRange
  ctx        LSPCodeActionContext
  generation uint64
}

type pendingExecuteCommandRequest struct {
  args                []json.RawMessage
  argumentGenerations map[string]uint64
  documentGenerations map[string]uint64
}

type cachedDiagnostics struct {
  version     *int
  diagnostics []json.RawMessage
}

// NewProxy returns a Proxy ready to Run. The PluginSource is required;
// pass NullPluginSource{} for a no-contribution setup.
func NewProxy(opts ProxyOptions) *Proxy {
  source := opts.Source
  if source == nil {
    source = NullPluginSource{}
  }
  proxy := &Proxy{
    editorIn:                       opts.EditorIn,
    editorOut:                      opts.EditorOut,
    upstreamIn:                     opts.UpstreamIn,
    upstreamOut:                    opts.UpstreamOut,
    source:                         source,
    suppressExecuteCommandProvider: opts.SuppressExecuteCommandProvider,
    suppressedExecuteCommandIDs:    commandIDSet(opts.SuppressedExecuteCommandIDs),
    executeCommandIDPrefix:         opts.ExecuteCommandIDPrefix,
    symbolProvider:                 opts.SymbolProvider,
    forceLocalSymbolProvider:       opts.ForceLocalSymbolProvider,
    asyncErrCh:                     make(chan error, 1),
    pendingActions:                 make(map[string]pendingCodeActionRequest),
    pendingAugmentingActions:       make(map[string]struct{}),
    pendingLocalActions:            make(map[string]struct{}),
    pendingCommands:                make(map[string]struct{}),
    pendingClientRequests:          make(map[string]func(Envelope)),
    pendingInitialize:              make(map[string]struct{}),
    upstreamCodeActionProvider:     true,
    upstreamDiagnostics:            make(map[string]cachedDiagnostics),
    pluginDiagnostics:              make(map[string]cachedDiagnostics),
    diagnosticGeneration:           make(map[string]uint64),
    documentGeneration:             make(map[string]uint64),
    dirtyDocuments:                 make(map[string]struct{}),
    dirtyVersions:                  make(map[string]*int),
    documentText:                   make(map[string]string),
  }
  // Optional-interface assertion for the same reason pluginCompletionHints uses
  // one: a source that publishes no corpus, NullPluginSource included, simply
  // never reports one changing.
  type completionHintObserverSource interface {
    SetCompletionHintsObserver(func())
  }
  if observed, ok := source.(completionHintObserverSource); ok {
    observed.SetCompletionHintsObserver(proxy.completionHintsRefreshed)
  }
  type projectInputObserverSource interface {
    SetProjectInputsObserver(func())
  }
  if observed, ok := source.(projectInputObserverSource); ok {
    observed.SetProjectInputsObserver(func() {
      go proxy.projectInputsRefreshed()
    })
  }
  return proxy
}

// Run drives both pump goroutines until they return. Pumps return when
// their input stream closes (ErrFrameClosed), when context cancellation
// has already been observed by the upstream/editor closers, or when a
// pipe write fails. ErrFrameClosed and context.Canceled are folded into
// a nil result so editor shutdown does not look like a crash.
func (p *Proxy) Run(ctx context.Context) error {
  defer p.stopProjectDiagnosticRefresh()
  errCh := make(chan error, 2)
  go func() { errCh <- p.pumpEditorToUpstream(ctx) }()
  go func() { errCh <- p.pumpUpstreamToEditor(ctx) }()

  var first error
  for completed := 0; completed < 2; {
    var err error
    select {
    case err = <-errCh:
      completed++
    case err = <-p.asyncErrCh:
    }
    if first == nil && err != nil && !errors.Is(err, ErrFrameClosed) && !errors.Is(err, context.Canceled) {
      first = err
      p.closeAfterPumpError()
    }
  }
  return first
}

// closeAfterPumpError unblocks the opposite pump after one side reports a hard
// transport error. In production RunLSPServer passes closeable pipe ends, and
// tests may pass plain readers/writers where the assertions close streams
// themselves.
func (p *Proxy) closeAfterPumpError() {
  closeIfCloser(p.editorIn)
  closeIfCloser(p.upstreamOut)
  closeIfCloser(p.upstreamIn)
}

// pumpEditorToUpstream reads frames from the editor, decides whether to
// forward verbatim or handle locally (executeCommand for ttsc commands,
// codeAction request bookkeeping), and writes the chosen frame. When the
// editor closes its end (ErrFrameClosed) the pump closes the upstream
// writer so tsgo's server-side Read returns EOF and its Run loop drains;
// without that nudge tsgo would wait forever for more input.
func (p *Proxy) pumpEditorToUpstream(_ context.Context) error {
  fr := NewFrameReader(p.editorIn)
  for {
    _, body, err := fr.Read()
    if err != nil {
      if errors.Is(err, ErrFrameClosed) {
        p.closeUpstreamInput()
      }
      return err
    }
    env, parseErr := ParseEnvelope(body)
    if parseErr != nil {
      if forwardErr := p.writeUpstreamFrame(body); forwardErr != nil {
        return forwardErr
      }
      continue
    }
    handled, handleErr := p.handleEditorEnvelope(env, body)
    if handleErr != nil {
      return handleErr
    }
    if handled {
      continue
    }
    if err := p.writeUpstreamFrame(constrainInitializePositionEncoding(env, body)); err != nil {
      return err
    }
    if env.IsNotification() && env.Method == methodInitialized {
      go p.projectInputWatchInitialized()
    }
  }
}

// closeUpstreamInput closes the upstream writer (if it is also an
// io.Closer) so the upstream process reads io.EOF and exits its read loop.
// We type-assert because the public ProxyOptions surface promises only
// io.Writer; RunLSPServer always passes an *io.PipeWriter in practice.
func (p *Proxy) closeUpstreamInput() {
  if closer, ok := p.upstreamIn.(io.Closer); ok {
    _ = closer.Close()
  }
}

// handleEditorEnvelope returns true if the envelope was fully processed
// locally (responded to without forwarding upstream).
func (p *Proxy) handleEditorEnvelope(env Envelope, body []byte) (bool, error) {
  if env.IsResponse() && p.handleClientRequestResponse(env) {
    return true, nil
  }
  switch env.Method {
  case methodInitialize:
    if env.IsRequest() {
      p.rememberInitializeRequest(env)
    }
  case methodDidOpen:
    if env.IsNotification() {
      p.cacheDidOpenText(env)
      if err := p.publishPluginDiagnosticsForDidOpen(env); err != nil {
        return false, err
      }
    }
  case methodDidSave:
    if env.IsNotification() {
      p.invalidateSymbolProvider()
      p.invalidateResidentPlugins(env)
      p.refreshPluginCompletionHints()
      p.publishPluginDiagnosticsForDocumentNotification(env)
      p.resumePendingProjectDiagnosticRefresh()
    }
  case methodDidChangeConfiguration:
    if env.IsNotification() {
      // A rule can be enabled from editor settings, so the corpus may have gone
      // stale. Watched-file changes schedule the same refresh, but from inside
      // invalidateForWatchedFileChanges, which knows whether anything actually
      // changed.
      p.refreshPluginCompletionHints()
      p.refreshProjectInputs()
    }
  case methodDidChange:
    if env.IsNotification() {
      p.invalidateSymbolProvider()
      // No resident invalidation on didChange: the buffer is dirty but disk is
      // unchanged, so the warm Program (built from disk) stays valid, and plugin
      // diagnostics and code actions are suppressed while dirty anyway. didSave
      // updates the Program incrementally once the edit reaches disk. No corpus
      // refresh either, for the same reason plus a sharper one: a refresh spawns
      // a sidecar per plugin, and completion is on the live-buffer hot path.
      p.cacheDidChangeText(env)
      if err := p.markDocumentDirty(env); err != nil {
        return false, err
      }
    }
  case methodDidClose:
    if env.IsNotification() {
      p.evictDocumentText(env)
      p.clearDocumentDiagnostics(env)
      p.resumePendingProjectDiagnosticRefresh()
    }
  case methodDidChangeWatchedFiles:
    if env.IsNotification() {
      // Refresh before the notification reaches tsgo, so no read that races
      // this frame can still be answered from the pre-change snapshot. The
      // notification itself keeps flowing upstream.
      if err := p.invalidateForWatchedFileChanges(env); err != nil {
        return false, err
      }
    }
  case methodExecuteCommand:
    if env.IsRequest() {
      return p.tryExecuteCommand(env)
    }
  case methodFormatting:
    if env.IsRequest() {
      return p.handleFormattingRequest(env)
    }
  case methodCodeAction:
    if env.IsRequest() {
      return p.handleCodeActionRequest(env)
    }
  case methodDocumentSymbol:
    if env.IsRequest() {
      return p.handleDocumentSymbolRequest(env)
    }
  case methodReferences:
    if env.IsRequest() {
      return p.handleReferencesRequest(env)
    }
  case methodCompletion:
    return p.handleCompletionRequest(env)
  case methodCompletionResolve:
    return p.handleCompletionResolveRequest(env)
  case methodExit:
    if env.IsNotification() {
      p.editorExit.Store(true)
    }
  case methodCancelRequest:
    // $/cancelRequest names an in-flight id the editor has given up on.
    // The proxy drops any pending codeAction entry for that id so the
    // map cannot grow unbounded across long editor sessions, then lets
    // the notification continue to upstream.
    p.forgetCancelledRequest(env)
  }
  return false, nil
}

// positionEncodingUTF16 is the one LSP PositionEncodingKind ttscserver speaks.
//
// LSP 3.17 negotiates the encoding of `Position.character` per session: the
// client offers `general.positionEncodings`, the server picks one, and every
// position on that session is counted in the winner. tsgo selects `utf-8`
// whenever a client offers it, but ttsc computes positions of its own — the
// incremental buffer cache, plugin completion, the lint sidecar's diagnostic,
// fix, suggestion and formatting ranges, and the graph symbol provider — and
// every one of those counts UTF-16 code units. Because the sidecar protocol
// carries no encoding field, a session negotiated as `utf-8` would put tsgo's
// half of each response on byte columns and ttsc's half on UTF-16 columns.
//
// ttscserver therefore settles the negotiation instead of tracking it, and
// constrains the session to UTF-16 (see constrainInitializePositionEncoding).
// UTF-16 is the LSP default and the encoding every conforming client supports,
// so no client loses a capability; what is given up is tsgo's byte-oriented fast
// path, which costs one line scan per converted position inside tsgo.
const positionEncodingUTF16 = "utf-16"

// constrainInitializePositionEncoding narrows the client's position-encoding
// offer to UTF-16 before the initialize request is forwarded upstream, so the
// encoding tsgo selects — and therefore the one it advertises back through the
// proxy to the client — is the encoding every ttsc-owned conversion counts.
//
// It is deliberately a no-op for any envelope that is not an initialize request,
// and for any offer that names no encoding other than UTF-16: an absent, null,
// empty, or UTF-16-only list already means UTF-16, and rewriting it to say the
// same thing would change bytes on the wire for nothing. Every other offer has
// its list replaced rather than filtered, so no third encoding can be selected
// either.
func constrainInitializePositionEncoding(env Envelope, body []byte) []byte {
  if env.Method != methodInitialize || !env.IsRequest() || len(env.Params) == 0 {
    return body
  }
  params := map[string]json.RawMessage{}
  if json.Unmarshal(env.Params, &params) != nil {
    return body
  }
  capabilities := map[string]json.RawMessage{}
  if raw, ok := params["capabilities"]; !ok || json.Unmarshal(raw, &capabilities) != nil {
    return body
  }
  general := map[string]json.RawMessage{}
  if raw, ok := capabilities["general"]; !ok || json.Unmarshal(raw, &general) != nil {
    return body
  }
  raw, ok := general["positionEncodings"]
  if !ok {
    return body
  }
  var offered []string
  if json.Unmarshal(raw, &offered) != nil {
    return body
  }
  if !offersEncodingOtherThanUTF16(offered) {
    // Absent, null, empty, and UTF-16-only offers all already mean UTF-16.
    return body
  }
  constrained, err := json.Marshal([]string{positionEncodingUTF16})
  if err != nil {
    return body
  }
  // Re-encode only the subtree that changed: every sibling value stays the
  // client's original bytes, so a large or unusually shaped initialize payload
  // reaches tsgo exactly as it was sent.
  general["positionEncodings"] = constrained
  encodedGeneral, err := json.Marshal(general)
  if err != nil {
    return body
  }
  capabilities["general"] = encodedGeneral
  encodedCapabilities, err := json.Marshal(capabilities)
  if err != nil {
    return body
  }
  params["capabilities"] = encodedCapabilities
  encodedParams, err := json.Marshal(params)
  if err != nil {
    return body
  }
  env.Params = encodedParams
  encoded, err := json.Marshal(env)
  if err != nil {
    return body
  }
  return encoded
}

// offersEncodingOtherThanUTF16 reports whether a client's position-encoding
// offer could select anything but UTF-16. An absent, null, or empty list already
// means the LSP default, so those offers are left exactly as the client wrote
// them rather than rewritten to say the same thing.
func offersEncodingOtherThanUTF16(offered []string) bool {
  for _, encoding := range offered {
    if encoding != positionEncodingUTF16 {
      return true
    }
  }
  return false
}

// editorRequestedExit reports whether the editor sent the LSP `exit`
// notification.
//
// After `exit` the upstream process is required to terminate, and the status it
// terminates with is not ttscserver's to report. tsgo makes that distinction
// load-bearing rather than theoretical: its `exit` handler returns io.EOF, which
// cancels its dispatch loop, and whether its process ends 0 or 1 depends on
// whether that cancellation or the closed stdin reaches its errgroup first. The
// editor sees the same clean quit either way, so ttscserver must not turn one
// side of that race into a failed server.
func (p *Proxy) editorRequestedExit() bool {
  return p.editorExit.Load()
}

func (p *Proxy) rememberInitializeRequest(env Envelope) {
  key := env.IDKey()
  if key == "" {
    return
  }
  var params struct {
    Capabilities struct {
      Workspace struct {
        DidChangeWatchedFiles struct {
          DynamicRegistration    bool `json:"dynamicRegistration"`
          RelativePatternSupport bool `json:"relativePatternSupport"`
        } `json:"didChangeWatchedFiles"`
      } `json:"workspace"`
    } `json:"capabilities"`
  }
  if json.Unmarshal(env.Params, &params) == nil {
    p.capabilityMu.Lock()
    p.projectInputWatchDynamic =
      params.Capabilities.Workspace.DidChangeWatchedFiles.DynamicRegistration
    p.projectInputWatchRelative =
      params.Capabilities.Workspace.DidChangeWatchedFiles.RelativePatternSupport
    p.capabilityMu.Unlock()
  }
  p.pendingMu.Lock()
  defer p.pendingMu.Unlock()
  p.pendingInitialize[key] = struct{}{}
}

// forgetCancelledRequest removes any pending codeAction entry whose id
// the editor cancelled. The notification still flows to upstream so
// tsgo can respond with its own cancellation error. The id is keyed
// through the shared normalizer so a cancel for `1.0` deletes an entry
// stored under `1` (and vice versa for string-vs-numeric encodings).
func (p *Proxy) forgetCancelledRequest(env Envelope) {
  var params struct {
    ID json.RawMessage `json:"id"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil {
    return
  }
  key := idKeyFromRaw(params.ID)
  if key == "" {
    return
  }
  p.pendingMu.Lock()
  defer p.pendingMu.Unlock()
  if _, ok := p.pendingActions[key]; ok {
    delete(p.pendingActions, key)
  }
  delete(p.pendingAugmentingActions, key)
  delete(p.pendingLocalActions, key)
  delete(p.pendingCommands, key)
  delete(p.pendingInitialize, key)
  // Completion is cancelled constantly — every keystroke supersedes the last
  // request — so a pending entry that outlived its cancel would leak per
  // character typed.
  delete(p.pendingCompletions, key)
}

func (p *Proxy) handleCodeActionRequest(env Envelope) (bool, error) {
  pending, ok := p.decodeCodeActionRequest(env)
  if !ok {
    return false, nil
  }
  if p.isDocumentDirty(pending.uri) {
    if !p.shouldForwardCodeActionRequest(pending) {
      return true, p.writeResult(env.ID, []LSPCodeAction{})
    }
    return false, nil
  }
  pending.generation = p.documentGenerationFor(pending.uri)
  if !p.shouldForwardCodeActionRequest(pending) {
    key := env.IDKey()
    if key != "" {
      p.pendingMu.Lock()
      p.pendingLocalActions[key] = struct{}{}
      p.pendingMu.Unlock()
    }
    go func() {
      if !p.isDocumentCleanAt(pending.uri, pending.generation) {
        if key != "" && !p.takePendingLocalCodeAction(key) {
          return
        }
        p.reportAsyncError(p.writeResult(env.ID, []LSPCodeAction{}))
        return
      }
      actions := p.source.CodeActions(pending.uri, pending.rng, pending.ctx)
      if !p.isDocumentCleanAt(pending.uri, pending.generation) {
        actions = []LSPCodeAction{}
      }
      if key != "" && !p.takePendingLocalCodeAction(key) {
        return
      }
      p.reportAsyncError(p.writeLocalCodeActionsResultIfCurrent(env.ID, actions, pending))
    }()
    return true, nil
  }
  key := env.IDKey()
  if key == "" {
    return false, nil
  }
  p.pendingMu.Lock()
  defer p.pendingMu.Unlock()
  p.pendingActions[key] = pending
  return false, nil
}

func (p *Proxy) takePendingLocalCodeAction(key string) bool {
  p.pendingMu.Lock()
  defer p.pendingMu.Unlock()
  if _, ok := p.pendingLocalActions[key]; !ok {
    return false
  }
  delete(p.pendingLocalActions, key)
  return true
}

func (p *Proxy) takePendingAugmentingCodeAction(key string) bool {
  p.pendingMu.Lock()
  defer p.pendingMu.Unlock()
  if _, ok := p.pendingAugmentingActions[key]; !ok {
    return false
  }
  delete(p.pendingAugmentingActions, key)
  return true
}

func (p *Proxy) takePendingCommand(key string) bool {
  p.pendingMu.Lock()
  defer p.pendingMu.Unlock()
  if _, ok := p.pendingCommands[key]; !ok {
    return false
  }
  delete(p.pendingCommands, key)
  return true
}

type codeActionPositionWire struct {
  Line      *int `json:"line"`
  Character *int `json:"character"`
}

type codeActionRangeWire struct {
  Start *codeActionPositionWire `json:"start"`
  End   *codeActionPositionWire `json:"end"`
}

// decodeCodeActionRequest extracts the request payload so the matching
// response from upstream can be augmented with ttsc-owned code actions
// for the same range.
func (p *Proxy) decodeCodeActionRequest(env Envelope) (pendingCodeActionRequest, bool) {
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
    Range   *codeActionRangeWire `json:"range"`
    Context LSPCodeActionContext `json:"context"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil {
    return pendingCodeActionRequest{}, false
  }
  if params.TextDocument.URI == "" || params.Range == nil ||
    params.Range.Start == nil || params.Range.End == nil ||
    params.Range.Start.Line == nil || params.Range.Start.Character == nil ||
    params.Range.End.Line == nil || params.Range.End.Character == nil {
    return pendingCodeActionRequest{}, false
  }
  rng := LSPRange{
    Start: LSPPosition{
      Line:      *params.Range.Start.Line,
      Character: *params.Range.Start.Character,
    },
    End: LSPPosition{
      Line:      *params.Range.End.Line,
      Character: *params.Range.End.Character,
    },
  }
  if rng.Start.Line < 0 || rng.Start.Character < 0 ||
    rng.End.Line < 0 || rng.End.Character < 0 ||
    rng.Start.Line > rng.End.Line ||
    (rng.Start.Line == rng.End.Line && rng.Start.Character > rng.End.Character) {
    return pendingCodeActionRequest{}, false
  }
  return pendingCodeActionRequest{
    uri: params.TextDocument.URI,
    rng: rng,
    ctx: params.Context,
  }, true
}

func (p *Proxy) shouldForwardCodeActionRequest(pending pendingCodeActionRequest) bool {
  p.capabilityMu.Lock()
  upstreamProvidesCodeActions := p.upstreamCodeActionProvider
  p.capabilityMu.Unlock()
  return upstreamProvidesCodeActions && !p.isPluginOnlyCodeActionRequest(pending.ctx)
}

func (p *Proxy) isPluginOnlyCodeActionRequest(ctx LSPCodeActionContext) bool {
  if len(ctx.Only) == 0 {
    return false
  }
  kinds := p.pluginOnlyCodeActionKinds()
  for _, kind := range p.pluginCodeActionKinds() {
    if kind != "" {
      kinds[kind] = struct{}{}
    }
  }
  for _, kind := range ctx.Only {
    if _, ok := kinds[kind]; !ok {
      return false
    }
  }
  return true
}

func (p *Proxy) pluginOnlyCodeActionKinds() map[string]struct{} {
  kinds := map[string]struct{}{
    "source.fixAll.ttsc": {},
  }
  if p.ownsCommand(formatDocumentCommand) {
    kinds["source.format"] = struct{}{}
  }
  return kinds
}

// tryExecuteCommand handles workspace/executeCommand requests whose command id
// is registered with the PluginSource. Returns true for locally owned commands
// and false when the command is not ttsc-owned and should flow to upstream tsgo.
func (p *Proxy) tryExecuteCommand(env Envelope) (bool, error) {
  var params struct {
    Command   string            `json:"command"`
    Arguments []json.RawMessage `json:"arguments,omitempty"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil {
    return false, nil
  }
  command := p.sourceCommandID(params.Command)
  if !p.ownsCommand(command) {
    return false, nil
  }
  if p.argumentsContainDirtyDocument(params.Arguments) {
    return true, p.writeResult(env.ID, nil)
  }
  pending := pendingExecuteCommandRequest{
    args:                params.Arguments,
    argumentGenerations: p.documentGenerationsForArguments(params.Arguments),
    documentGenerations: p.documentGenerationSnapshot(),
  }
  key := env.IDKey()
  if key != "" {
    p.pendingMu.Lock()
    p.pendingCommands[key] = struct{}{}
    p.pendingMu.Unlock()
  }
  go p.completeExecuteCommand(env, key, command, pending)
  return true, nil
}

func (p *Proxy) completeExecuteCommand(env Envelope, key string, command string, pending pendingExecuteCommandRequest) {
  edit, err := p.source.ExecuteCommand(command, pending.args)
  if key != "" && !p.takePendingCommand(key) {
    return
  }
  if errors.Is(err, ErrCommandNotHandled) {
    p.reportAsyncError(p.writeError(env.ID, fmt.Sprintf("ttsc command %q was advertised but not handled", command)))
    return
  }
  if err != nil {
    p.reportAsyncError(p.writeExecuteCommandErrorIfClean(env.ID, pending, fmt.Sprintf("ttsc command %q failed: %v", command, err)))
    return
  }
  // Cycle 1 returns the WorkspaceEdit inside the executeCommand response
  // instead of sending workspace/applyEdit as a server→client request.
  // ttsc owns both ends (its VS Code extension), so the extension applies
  // the edit on its side. Sticking to one direction avoids tracking our
  // own outgoing request ids in the proxy.
  p.reportAsyncError(p.writeExecuteCommandResultIfClean(env.ID, pending, edit))
}

// contentExecutor is the optional capability a PluginSource exposes to format an
// in-memory buffer instead of the on-disk file. NativePluginSource implements it
// by piping the buffer to the sidecar's stdin with --content-stdin; sources that
// do not implement it fall back to plain ExecuteCommand (disk).
type contentExecutor interface {
  ExecuteCommandWithContent(command string, args []json.RawMessage, content string, hasContent bool) (*LSPWorkspaceEdit, error)
}

// handleFormattingRequest answers textDocument/formatting for the ttsc-owned
// document formatter. Unlike the workspace/executeCommand path, this handler
// intentionally formats the live (possibly dirty) editor buffer: it reads the
// cached buffer text and passes it to the sidecar so formatOnSave works before
// the file is written to disk. It therefore does NOT go through the
// dirty-document guard that writeExecuteCommandResultIfClean applies to the
// executeCommand path.
//
// When ttsc does not own ttsc.format.document the request is forwarded to
// upstream tsgo (return false). The handler never surfaces an error to the
// editor: on any failure it replies with an empty TextEdit array so a failed
// formatter cannot break the save.
func (p *Proxy) handleFormattingRequest(env Envelope) (bool, error) {
  if !p.ownsCommand(formatDocumentCommand) {
    return false, nil
  }
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return false, nil
  }
  uri := params.TextDocument.URI
  go p.completeFormattingRequest(env, uri)
  return true, nil
}

func (p *Proxy) completeFormattingRequest(env Envelope, uri string) {
  // hasContent distinguishes "the proxy has a buffer to format in-memory" from
  // "no buffer; let the sidecar read disk". An empty cached buffer is a valid
  // document state (the user cleared the file), so the empty string must NOT be
  // overloaded as the no-buffer sentinel: a cache hit always yields
  // hasContent=true even when the buffer is "".
  content, hasContent := p.cachedDocumentText(uri)
  if !hasContent {
    if file, fileOK := filePathFromURI(uri); fileOK {
      if disk, err := os.ReadFile(file); err == nil {
        // Preserve the existing disk-fallback behavior: pipe the disk bytes
        // via stdin so the sidecar formats exactly what the proxy read.
        content = string(disk)
        hasContent = true
      }
    }
  }
  // A formatter failure must never break the editor's save: reply with an
  // empty TextEdit[] regardless of the error. The NativePluginSource already
  // logs the underlying sidecar failure to its own stderr writer, so the proxy
  // does not need a separate log sink here.
  edit, err := p.executeFormatCommand(uri, content, hasContent)
  if err != nil {
    p.reportAsyncError(p.writeResult(env.ID, []LSPTextEdit{}))
    return
  }
  edits := formattingTextEdits(edit, uri)
  p.reportAsyncError(p.writeResult(env.ID, edits))
}

// executeFormatCommand runs ttsc.format.document against the supplied buffer
// text. The single command argument is the document uri, matching the
// executeCommand path the sidecar already implements; --content-stdin makes the
// sidecar format the piped text instead of the disk file when the source
// supports it.
func (p *Proxy) executeFormatCommand(uri string, content string, hasContent bool) (*LSPWorkspaceEdit, error) {
  arg, _ := json.Marshal(uri)
  args := []json.RawMessage{arg}
  if executor, ok := p.source.(contentExecutor); ok {
    return executor.ExecuteCommandWithContent(formatDocumentCommand, args, content, hasContent)
  }
  return p.source.ExecuteCommand(formatDocumentCommand, args)
}

// formattingTextEdits projects a WorkspaceEdit returned by the formatter onto
// the LSP textDocument/formatting response shape: the array of TextEdits that
// target uri. A nil edit or a no-op (no changes for uri) yields an empty,
// non-nil slice so the editor always receives a valid TextEdit[].
func formattingTextEdits(edit *LSPWorkspaceEdit, uri string) []LSPTextEdit {
  if edit == nil {
    return []LSPTextEdit{}
  }
  edits, ok := edit.Changes[uri]
  if !ok || edits == nil {
    return []LSPTextEdit{}
  }
  return edits
}

// ownsCommand reports whether command is registered with the PluginSource
// and should be handled locally rather than forwarded to upstream tsgo.
func (p *Proxy) ownsCommand(command string) bool {
  for _, id := range p.source.CommandIDs() {
    if id == command {
      return true
    }
  }
  return false
}

func (p *Proxy) sourceCommandID(command string) string {
  if p.executeCommandIDPrefix == "" || !strings.HasPrefix(command, p.executeCommandIDPrefix) {
    return command
  }
  unprefixed := strings.TrimPrefix(command, p.executeCommandIDPrefix)
  if p.ownsCommand(unprefixed) {
    return unprefixed
  }
  return command
}

func (p *Proxy) argumentsContainDirtyDocument(args []json.RawMessage) bool {
  for _, arg := range args {
    var value any
    if err := json.Unmarshal(arg, &value); err != nil {
      continue
    }
    if p.valueContainsDirtyDocument(value) {
      return true
    }
  }
  return false
}

func (p *Proxy) valueContainsDirtyDocument(value any) bool {
  switch v := value.(type) {
  case string:
    return p.isDocumentDirty(v)
  case []any:
    for _, item := range v {
      if p.valueContainsDirtyDocument(item) {
        return true
      }
    }
  case map[string]any:
    for _, item := range v {
      if p.valueContainsDirtyDocument(item) {
        return true
      }
    }
  }
  return false
}

func (p *Proxy) workspaceEditTargetsDirtyDocument(edit *LSPWorkspaceEdit) bool {
  if edit == nil {
    return false
  }
  for uri := range edit.Changes {
    if p.isDocumentDirty(uri) {
      return true
    }
  }
  return false
}

func (p *Proxy) documentGenerationsForArguments(args []json.RawMessage) map[string]uint64 {
  values := map[string]struct{}{}
  for _, arg := range args {
    var value any
    if err := json.Unmarshal(arg, &value); err != nil {
      continue
    }
    collectDocumentURIStrings(value, values)
  }
  if len(values) == 0 {
    return nil
  }
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  generations := make(map[string]uint64, len(values))
  for uri := range values {
    generations[uri] = p.documentGeneration[uri]
  }
  return generations
}

func (p *Proxy) documentGenerationSnapshot() map[string]uint64 {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  if len(p.documentGeneration) == 0 {
    return nil
  }
  out := make(map[string]uint64, len(p.documentGeneration))
  for uri, generation := range p.documentGeneration {
    out[uri] = generation
  }
  return out
}

func collectDocumentURIStrings(value any, out map[string]struct{}) {
  switch v := value.(type) {
  case string:
    if strings.HasPrefix(v, "file://") {
      out[v] = struct{}{}
    }
  case []any:
    for _, item := range v {
      collectDocumentURIStrings(item, out)
    }
  case map[string]any:
    for _, item := range v {
      collectDocumentURIStrings(item, out)
    }
  }
}

func (p *Proxy) argumentsContainDirtyDocumentLocked(args []json.RawMessage) bool {
  for _, arg := range args {
    var value any
    if err := json.Unmarshal(arg, &value); err != nil {
      continue
    }
    if p.valueContainsDirtyDocumentLocked(value) {
      return true
    }
  }
  return false
}

func (p *Proxy) valueContainsDirtyDocumentLocked(value any) bool {
  switch v := value.(type) {
  case string:
    _, dirty := p.dirtyDocuments[v]
    return dirty
  case []any:
    for _, item := range v {
      if p.valueContainsDirtyDocumentLocked(item) {
        return true
      }
    }
  case map[string]any:
    for _, item := range v {
      if p.valueContainsDirtyDocumentLocked(item) {
        return true
      }
    }
  }
  return false
}

func (p *Proxy) workspaceEditTargetsDirtyDocumentLocked(edit *LSPWorkspaceEdit) bool {
  if edit == nil {
    return false
  }
  for uri := range edit.Changes {
    if _, dirty := p.dirtyDocuments[uri]; dirty {
      return true
    }
  }
  return false
}

func (p *Proxy) workspaceEditTargetsChangedLocked(edit *LSPWorkspaceEdit, generations map[string]uint64) bool {
  if edit == nil {
    return false
  }
  for uri := range edit.Changes {
    if p.documentGeneration[uri] != generations[uri] {
      return true
    }
  }
  return false
}

func (p *Proxy) documentGenerationsChangedLocked(generations map[string]uint64) bool {
  for uri, generation := range generations {
    if p.documentGeneration[uri] != generation {
      return true
    }
  }
  return false
}

// pumpUpstreamToEditor reads frames from the upstream tsgo server,
// augments publishDiagnostics and codeAction responses, and forwards
// every other frame untouched. The loop terminates on Read error; ctx
// propagation happens through pipe closure by RunLSPServer's deferred
// cleanup goroutines.
func (p *Proxy) pumpUpstreamToEditor(_ context.Context) error {
  fr := NewFrameReader(p.upstreamOut)
  for {
    _, body, err := fr.Read()
    if err != nil {
      return err
    }
    env, parseErr := ParseEnvelope(body)
    if parseErr != nil {
      if forwardErr := p.writeEditorFrame(body); forwardErr != nil {
        return forwardErr
      }
      continue
    }
    if env.IsNotification() && env.Method == methodPublishDiagnostics {
      publishPlugin := p.prepareUpstreamPublishDiagnostics(env)
      if err := p.writeEditorFrame(body); err != nil {
        return err
      }
      if publishPlugin != nil {
        go publishPlugin()
      }
      continue
    }
    augmented := p.augmentUpstream(env, body)
    if augmented == nil {
      continue
    }
    if err := p.writeEditorFrame(augmented); err != nil {
      return err
    }
  }
}

// augmentUpstream returns the (possibly rewritten) body to forward. For
// codeAction responses tied to a remembered request it appends ttsc actions.
//
// Cancellation and response are handled in two independent goroutines
// (pumpEditorToUpstream owns $/cancelRequest cleanup, pumpUpstreamToEditor
// owns response augmentation). When the response wins the race against
// a pending cancel, pendingActions[env.IDKey()] is still populated and
// the response is augmented before forgetCancelledRequest runs — the
// editor is expected to discard the late response per LSP $/cancelRequest
// semantics. When the cancel wins, the pending entry is gone and
// augmentation skips cleanly.
func (p *Proxy) augmentUpstream(env Envelope, body []byte) []byte {
  if env.IsResponse() {
    key := env.IDKey()
    if key == "" {
      return body
    }
    p.pendingMu.Lock()
    pending, ok := p.pendingActions[key]
    if ok {
      delete(p.pendingActions, key)
      p.pendingAugmentingActions[key] = struct{}{}
    }
    _, pendingInitialize := p.pendingInitialize[key]
    if pendingInitialize {
      delete(p.pendingInitialize, key)
    }
    completions, hasCompletions := p.pendingCompletions[key]
    if hasCompletions {
      delete(p.pendingCompletions, key)
    }
    p.pendingMu.Unlock()
    if hasCompletions {
      return mergeCompletionResponseWithRequest(body, completions)
    }
    if pendingInitialize {
      if augmented, augOk := p.augmentInitializeResult(env); augOk {
        return augmented
      }
    }
    if ok {
      go p.completeCodeActionResponse(env, body, key, pending)
      return nil
    }
  }
  return body
}

func (p *Proxy) completeCodeActionResponse(env Envelope, body []byte, key string, pending pendingCodeActionRequest) {
  if augmented, ok := p.appendCodeActions(env, pending); ok {
    if key != "" && !p.takePendingAugmentingCodeAction(key) {
      return
    }
    p.reportAsyncError(p.writeAugmentedCodeActionFrameIfCurrent(pending, augmented, body))
    return
  }
  if key != "" && !p.takePendingAugmentingCodeAction(key) {
    return
  }
  p.reportAsyncError(p.writeEditorFrame(body))
}

func (p *Proxy) prepareUpstreamPublishDiagnostics(env Envelope) func() {
  var params struct {
    URI         string            `json:"uri"`
    Version     *int              `json:"version,omitempty"`
    Diagnostics []json.RawMessage `json:"diagnostics"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.URI == "" {
    return nil
  }
  if p.isDocumentDirty(params.URI) {
    if p.shouldRememberDirtyUpstreamDiagnostics(params.URI, params.Version) {
      p.rememberUpstreamDiagnostics(params.URI, params.Version, params.Diagnostics)
    }
    return nil
  }
  p.rememberUpstreamDiagnostics(params.URI, params.Version, params.Diagnostics)
  generation, projectGeneration := p.nextDiagnosticsGenerations(params.URI)
  return func() {
    p.publishMergedPluginDiagnostics(params.URI, params.Version, true, generation, projectGeneration)
  }
}

func (p *Proxy) publishPluginDiagnosticsForDocumentNotification(env Envelope) {
  var params struct {
    TextDocument struct {
      URI     string `json:"uri"`
      Version *int   `json:"version,omitempty"`
    } `json:"textDocument"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return
  }
  p.markDocumentClean(params.TextDocument.URI)
  generation, projectGeneration := p.nextDiagnosticsGenerations(params.TextDocument.URI)
  go p.publishMergedPluginDiagnostics(params.TextDocument.URI, params.TextDocument.Version, false, generation, projectGeneration)
}

func (p *Proxy) publishPluginDiagnosticsForDidOpen(env Envelope) error {
  var params struct {
    TextDocument struct {
      URI     string `json:"uri"`
      Version *int   `json:"version,omitempty"`
      Text    string `json:"text"`
    } `json:"textDocument"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return nil
  }
  if !documentTextMatchesDisk(params.TextDocument.URI, params.TextDocument.Text) {
    if p.markDocumentDirtyURI(params.TextDocument.URI, params.TextDocument.Version) {
      return p.writePublishDiagnostics(params.TextDocument.URI, params.TextDocument.Version, []json.RawMessage{})
    }
    return nil
  }
  p.markDocumentClean(params.TextDocument.URI)
  // A clean open is a disk-snapshot boundary, not merely a diagnostics trigger.
  // The buffer equalling disk right now says nothing about when the warm Program
  // and the symbol graph last read that file: the document may have been closed
  // across a branch switch, a `git pull`, a generator run, or an edit in a second
  // editor. Refresh both compiler-backed caches for this document before the
  // asynchronous Diagnostics call below is scheduled, so the published findings
  // describe the text the editor just opened.
  //
  // The dirty branch above deliberately does not invalidate: it publishes an
  // empty set and reports nothing until the buffer reaches disk, so there is no
  // stale answer to prevent.
  p.invalidateSymbolProvider()
  p.invalidateResidentPluginsForURIs(params.TextDocument.URI)
  generation, projectGeneration := p.nextDiagnosticsGenerations(params.TextDocument.URI)
  go p.publishMergedPluginDiagnostics(params.TextDocument.URI, params.TextDocument.Version, false, generation, projectGeneration)
  return nil
}

func (p *Proxy) publishMergedPluginDiagnostics(uri string, version *int, adoptCachedVersion bool, generation uint64, projectGeneration uint64) {
  if !p.isLatestPluginDiagnosticsGeneration(uri, generation) || p.isDocumentDirty(uri) {
    return
  }
  diagnostics := p.source.Diagnostics(LSPDocumentVersion{
    URI:     uri,
    Version: version,
  })
  version, merged, ok := p.prepareMergedPluginDiagnostics(uri, version, adoptCachedVersion, generation, diagnostics.Document)
  if ok {
    p.reportAsyncError(p.writePublishDiagnosticsIfCurrent(uri, version, merged, generation))
  }
  if diagnostics.Project != nil && !p.hasDirtyDocuments() {
    writeResult, err := p.writeProjectDiagnosticsIfCurrent(
      diagnostics.Project,
      projectGeneration,
      false,
    )
    p.reportAsyncError(err)
    if writeResult.frameWritten &&
      p.pendingProjectDiagnosticOwnersRefreshed(
        diagnostics.projectUpdatedProducers,
      ) {
      p.completePendingProjectDiagnosticRefresh(projectGeneration)
    }
  }
}

func (p *Proxy) writePublishDiagnostics(uri string, version *int, diagnostics []json.RawMessage) error {
  return p.writeEditorFrame(p.publishDiagnosticsBody(uri, version, diagnostics))
}

func (p *Proxy) writePublishDiagnosticsIfCurrent(uri string, version *int, diagnostics []json.RawMessage, generation uint64) error {
  body := p.publishDiagnosticsBody(uri, version, diagnostics)
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  _, dirty := p.dirtyDocuments[uri]
  current := p.diagnosticGeneration[uri] == generation && !dirty
  if !current {
    return nil
  }
  return WriteFrame(p.editorOut, body)
}

func (p *Proxy) writeProjectDiagnosticsIfCurrent(
  publication *LSPProjectDiagnostics,
  generation uint64,
  publishEmpty bool,
) (projectDiagnosticsWriteResult, error) {
  if publication == nil || publication.URI == "" {
    return projectDiagnosticsWriteResult{}, nil
  }
  diagnostics := append([]LSPDiagnostic(nil), publication.Diagnostics...)
  for index := range diagnostics {
    diagnostics[index].Range = LSPRange{}
  }
  rawDiagnostics := marshalLSPDiagnostics(diagnostics)
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  if p.projectDiagnosticGeneration != generation ||
    len(p.dirtyDocuments) != 0 {
    return projectDiagnosticsWriteResult{}, nil
  }

  previousURI := p.projectDiagnosticsURI
  previousHadDiagnostics := len(p.projectDiagnostics.diagnostics) > 0
  changedURI := previousURI != "" && previousURI != publication.URI
  if changedURI {
    p.projectDiagnosticsURI = ""
    p.projectDiagnostics = cachedDiagnostics{}
    if err := WriteFrame(
      p.editorOut,
      p.publishDiagnosticsBody(previousURI, nil, p.mergedDiagnosticsLocked(previousURI)),
    ); err != nil {
      return projectDiagnosticsWriteResult{}, err
    }
  }

  p.projectDiagnosticsURI = publication.URI
  p.projectDiagnostics = cachedDiagnostics{diagnostics: copyRawDiagnostics(rawDiagnostics)}
  if len(rawDiagnostics) == 0 &&
    !publishEmpty &&
    !previousHadDiagnostics &&
    !changedURI {
    return projectDiagnosticsWriteResult{accepted: true}, nil
  }
  if err := WriteFrame(
    p.editorOut,
    p.publishDiagnosticsBody(publication.URI, nil, p.mergedDiagnosticsLocked(publication.URI)),
  ); err != nil {
    return projectDiagnosticsWriteResult{}, err
  }
  return projectDiagnosticsWriteResult{
    accepted:     true,
    frameWritten: true,
  }, nil
}

type projectDiagnosticsWriteResult struct {
  accepted     bool
  frameWritten bool
}

func marshalLSPDiagnostics(diagnostics []LSPDiagnostic) []json.RawMessage {
  rawDiagnostics := make([]json.RawMessage, 0, len(diagnostics))
  for _, diagnostic := range diagnostics {
    raw, _ := json.Marshal(diagnostic)
    rawDiagnostics = append(rawDiagnostics, raw)
  }
  return rawDiagnostics
}

func (p *Proxy) mergedDiagnosticsLocked(uri string) []json.RawMessage {
  upstream := p.upstreamDiagnostics[uri].diagnostics
  document := p.pluginDiagnostics[uri].diagnostics
  project := []json.RawMessage(nil)
  if p.projectDiagnosticsURI == uri {
    project = p.projectDiagnostics.diagnostics
  }
  merged := make([]json.RawMessage, 0, len(upstream)+len(document)+len(project))
  merged = append(merged, copyRawDiagnostics(upstream)...)
  merged = append(merged, copyRawDiagnostics(document)...)
  merged = append(merged, copyRawDiagnostics(project)...)
  return merged
}

func (p *Proxy) writeLocalCodeActionsResultIfCurrent(id json.RawMessage, actions []LSPCodeAction, pending pendingCodeActionRequest) error {
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  if _, dirty := p.dirtyDocuments[pending.uri]; dirty || p.documentGeneration[pending.uri] != pending.generation {
    actions = []LSPCodeAction{}
  }
  actions = p.rewriteCodeActionCommands(actions)
  return p.writeResultLocked(id, actions)
}

func (p *Proxy) writeAugmentedCodeActionFrameIfCurrent(pending pendingCodeActionRequest, augmented []byte, fallback []byte) error {
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  if _, dirty := p.dirtyDocuments[pending.uri]; dirty || p.documentGeneration[pending.uri] != pending.generation {
    return WriteFrame(p.editorOut, fallback)
  }
  return WriteFrame(p.editorOut, augmented)
}

func (p *Proxy) publishDiagnosticsBody(uri string, version *int, diagnostics []json.RawMessage) []byte {
  if diagnostics == nil {
    diagnostics = []json.RawMessage{}
  }
  rawParams, _ := json.Marshal(struct {
    URI         string            `json:"uri"`
    Version     *int              `json:"version,omitempty"`
    Diagnostics []json.RawMessage `json:"diagnostics"`
  }{
    URI:         uri,
    Version:     version,
    Diagnostics: diagnostics,
  })
  body, _ := json.Marshal(Envelope{
    JSONRPC: "2.0",
    Method:  methodPublishDiagnostics,
    Params:  rawParams,
  })
  return body
}

func (p *Proxy) clearDocumentDiagnostics(env Envelope) {
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return
  }
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  delete(p.upstreamDiagnostics, params.TextDocument.URI)
  delete(p.pluginDiagnostics, params.TextDocument.URI)
  delete(p.dirtyDocuments, params.TextDocument.URI)
  delete(p.dirtyVersions, params.TextDocument.URI)
  p.diagnosticGeneration[params.TextDocument.URI]++
  p.documentGeneration[params.TextDocument.URI]++
}

// cacheDidOpenText stores the buffer text the editor opened so the
// formatting handler can format the live document. didOpen always carries the
// full text, so the cache is unconditionally trustworthy here.
func (p *Proxy) cacheDidOpenText(env Envelope) {
  var params struct {
    TextDocument struct {
      URI  string `json:"uri"`
      Text string `json:"text"`
    } `json:"textDocument"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return
  }
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  p.documentText[params.TextDocument.URI] = params.TextDocument.Text
}

// cacheDidChangeText refreshes the buffer cache from a didChange notification.
// LSP delivers contentChanges either as full-document replacements (no range)
// or incremental range edits (a range present). The proxy does not control the
// advertised textDocumentSync kind — tsgo owns the initialize response and ttsc
// only augments code-action/executeCommand capabilities — so a client may send
// either shape. VS Code with tsgo uses incremental sync, so save-time
// formatting depends on applying ranged edits to the cache: a full replacement
// (Range == nil) overwrites the cached text, and a ranged change splices into
// the currently cached text so the cache always reflects the live buffer.
//
// A ranged change can only be applied when a base entry already exists for the
// uri (seeded by didOpen or a prior full replacement). If a ranged change
// arrives with no base — never opened, or a gap left the cache stale — the
// proxy cannot patch reliably, so it drops the entry and the formatting handler
// falls back to reading disk.
func (p *Proxy) cacheDidChangeText(env Envelope) {
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
    ContentChanges []struct {
      Range *lspRangeWire `json:"range"`
      Text  string        `json:"text"`
    } `json:"contentChanges"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return
  }
  if len(params.ContentChanges) == 0 {
    return
  }
  uri := params.TextDocument.URI
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  text, hasBase := p.documentText[uri]
  for _, change := range params.ContentChanges {
    if change.Range == nil {
      // Full-document replacement: overwrite the cached text wholesale. A
      // subsequent ranged change in the same notification patches this value.
      text = change.Text
      hasBase = true
      continue
    }
    if !hasBase {
      // Ranged change with no trustworthy base: drop the entry so formatting
      // falls back to disk rather than patching against missing text.
      delete(p.documentText, uri)
      return
    }
    start, okStart := lspPositionToByteOffset(text, change.Range.Start)
    end, okEnd := lspPositionToByteOffset(text, change.Range.End)
    if !okStart || !okEnd || start > end {
      // A position the proxy cannot map (out of range, malformed) means the
      // cache and the editor have diverged; drop the entry so the next format
      // reads disk instead of corrupting the buffer.
      delete(p.documentText, uri)
      return
    }
    text = text[:start] + change.Text + text[end:]
  }
  p.documentText[uri] = text
}

// lspPositionWire and lspRangeWire decode an LSP Position/Range from a
// didChange contentChange. They are local decode shapes so cacheDidChangeText
// can splice ranged edits into the cached buffer.
type lspPositionWire struct {
  Line      int `json:"line"`
  Character int `json:"character"`
}

type lspRangeWire struct {
  Start lspPositionWire `json:"start"`
  End   lspPositionWire `json:"end"`
}

// lspPositionToByteOffset converts an LSP Position into a byte offset into text.
//
// LSP Position.character is counted in the session's negotiated
// PositionEncodingKind, which constrainInitializePositionEncoding pins to UTF-16
// for every ttscserver session — so it is a UTF-16 code-unit offset here, not a
// byte or rune offset: a rune in the astral planes (>= U+10000) counts as two
// UTF-16 code units. The walk advances line by line over '\n' and '\r\n' endings
// to the target line, then advances `character` UTF-16 code units within that
// line and returns the corresponding byte index.
//
// Decision on out-of-range positions: when line/character point past the end of
// the text the function returns (len, false) rather than clamping — the caller
// treats !ok as a cache/editor divergence and drops the cache so formatting
// reads disk. A character that lands exactly at the line's end (e.g. the column
// just past the last code unit, which editors send for an end-of-line cursor)
// is in range and maps to the byte index of the line ending or end of text.
func lspPositionToByteOffset(text string, pos lspPositionWire) (int, bool) {
  if pos.Line < 0 || pos.Character < 0 {
    return len(text), false
  }
  i := 0
  line := 0
  // Advance to the start of the target line.
  for line < pos.Line {
    if i >= len(text) {
      return len(text), false
    }
    r, size := utf8.DecodeRuneInString(text[i:])
    if r == utf8.RuneError && size == 0 {
      return len(text), false
    }
    if r == '\r' {
      i += size
      if i < len(text) && text[i] == '\n' {
        i++
      }
      line++
      continue
    }
    if r == '\n' {
      i += size
      line++
      continue
    }
    i += size
  }
  // Advance `character` UTF-16 code units within the target line.
  units := 0
  for units < pos.Character {
    if i >= len(text) {
      return len(text), false
    }
    r, size := utf8.DecodeRuneInString(text[i:])
    if r == utf8.RuneError && size == 0 {
      return len(text), false
    }
    if r == '\n' || r == '\r' {
      // The character offset ran past the end of this line's content. LSP
      // clients should not address columns beyond the line, so treat it as a
      // divergence rather than silently wrapping onto the next line.
      return i, false
    }
    n := utf16.RuneLen(r)
    if n <= 0 {
      n = 1
    }
    units += n
    i += size
  }
  return i, true
}

// evictDocumentText drops the cached buffer for a closed document so a later
// reopen does not format against the previous session's text.
func (p *Proxy) evictDocumentText(env Envelope) {
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return
  }
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  delete(p.documentText, params.TextDocument.URI)
}

// cachedDocumentText returns the cached buffer text for uri and whether an
// entry was present.
func (p *Proxy) cachedDocumentText(uri string) (string, bool) {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  text, ok := p.documentText[uri]
  return text, ok
}

func (p *Proxy) markDocumentDirty(env Envelope) error {
  var params struct {
    TextDocument struct {
      URI     string `json:"uri"`
      Version *int   `json:"version,omitempty"`
    } `json:"textDocument"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil || params.TextDocument.URI == "" {
    return nil
  }
  cleared := p.markDocumentDirtyURI(params.TextDocument.URI, params.TextDocument.Version)
  if !cleared {
    return nil
  }
  return p.writePublishDiagnostics(params.TextDocument.URI, params.TextDocument.Version, []json.RawMessage{})
}

func (p *Proxy) markDocumentDirtyURI(uri string, version *int) bool {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  previous := p.pluginDiagnostics[uri]
  p.dirtyDocuments[uri] = struct{}{}
  if version != nil {
    copied := *version
    p.dirtyVersions[uri] = &copied
  } else {
    delete(p.dirtyVersions, uri)
  }
  delete(p.pluginDiagnostics, uri)
  delete(p.upstreamDiagnostics, uri)
  p.diagnosticGeneration[uri]++
  p.projectDiagnosticGeneration++
  p.documentGeneration[uri]++
  return len(previous.diagnostics) > 0
}

func (p *Proxy) markDocumentClean(uri string) {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  if _, ok := p.documentGeneration[uri]; !ok {
    p.documentGeneration[uri] = 0
  }
  delete(p.dirtyDocuments, uri)
  delete(p.dirtyVersions, uri)
}

func (p *Proxy) isDocumentDirty(uri string) bool {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  _, ok := p.dirtyDocuments[uri]
  return ok
}

func (p *Proxy) documentGenerationFor(uri string) uint64 {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  return p.documentGeneration[uri]
}

func (p *Proxy) isDocumentCleanAt(uri string, generation uint64) bool {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  _, dirty := p.dirtyDocuments[uri]
  return !dirty && p.documentGeneration[uri] == generation
}

func (p *Proxy) shouldRememberDirtyUpstreamDiagnostics(uri string, version *int) bool {
  if version == nil {
    return false
  }
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  dirtyVersion := p.dirtyVersions[uri]
  return dirtyVersion != nil && *dirtyVersion == *version
}

func documentTextMatchesDisk(uri string, text string) bool {
  file, ok := filePathFromURI(uri)
  if !ok {
    return false
  }
  disk, err := os.ReadFile(file)
  if err != nil {
    return false
  }
  // Editors commonly strip a leading UTF-8 BOM from the buffer text they send
  // while it stays on disk (or add one the disk lacks). A raw byte compare would
  // then misclassify an unedited file as dirty and suppress plugin diagnostics
  // until the first save, so a single leading BOM is dropped from both sides.
  return strings.TrimPrefix(string(disk), utf8BOM) == strings.TrimPrefix(text, utf8BOM)
}

func filePathFromURI(raw string) (string, bool) {
  parsed, err := url.Parse(raw)
  if err != nil || parsed.Scheme != "file" {
    return "", false
  }
  path := parsed.Path
  if parsed.Host != "" {
    path = "//" + parsed.Host + path
  }
  if path == "" {
    return "", false
  }
  if os.PathSeparator == '\\' && strings.HasPrefix(path, "/") && len(path) >= 3 && path[2] == ':' {
    path = path[1:]
  }
  abs, err := filepath.Abs(path)
  if err != nil {
    return "", false
  }
  return abs, true
}

func (p *Proxy) nextDiagnosticsGenerations(uri string) (uint64, uint64) {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  next := p.diagnosticGeneration[uri] + 1
  p.diagnosticGeneration[uri] = next
  p.projectDiagnosticGeneration++
  return next, p.projectDiagnosticGeneration
}

func (p *Proxy) isLatestPluginDiagnosticsGeneration(uri string, generation uint64) bool {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  return p.diagnosticGeneration[uri] == generation
}

func (p *Proxy) cachedUpstreamDiagnostics(uri string) cachedDiagnostics {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  cached := p.upstreamDiagnostics[uri]
  diagnostics := make([]json.RawMessage, len(cached.diagnostics))
  copy(diagnostics, cached.diagnostics)
  version := cached.version
  if version != nil {
    copied := *version
    version = &copied
  }
  return cachedDiagnostics{version: version, diagnostics: diagnostics}
}

func (p *Proxy) prepareMergedPluginDiagnostics(
  uri string,
  version *int,
  adoptCachedVersion bool,
  generation uint64,
  diagnostics []LSPDiagnostic,
) (*int, []json.RawMessage, bool) {
  if uri == "" {
    return nil, nil, false
  }
  rawDiagnostics := marshalLSPDiagnostics(diagnostics)
  inputVersion := copyIntPtr(version)

  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  if p.diagnosticGeneration[uri] != generation {
    return nil, nil, false
  }
  if _, dirty := p.dirtyDocuments[uri]; dirty {
    return nil, nil, false
  }
  cached := p.upstreamDiagnostics[uri]
  if inputVersion != nil && cached.version != nil && *inputVersion != *cached.version {
    return nil, nil, false
  }
  previousPluginDiagnostics := len(p.pluginDiagnostics[uri].diagnostics) > 0
  p.pluginDiagnostics[uri] = cachedDiagnostics{
    version:     copyIntPtr(inputVersion),
    diagnostics: copyRawDiagnostics(rawDiagnostics),
  }
  if adoptCachedVersion && cached.version != nil {
    version = cached.version
  } else {
    version = inputVersion
  }
  if len(rawDiagnostics) == 0 && !previousPluginDiagnostics {
    return nil, nil, false
  }
  merged := p.mergedDiagnosticsLocked(uri)
  return copyIntPtr(version), merged, true
}

func (p *Proxy) rememberPluginDiagnostics(uri string, version *int, diagnostics []LSPDiagnostic) bool {
  if uri == "" {
    return false
  }
  rawDiagnostics := make([]json.RawMessage, 0, len(diagnostics))
  for _, diagnostic := range diagnostics {
    raw, _ := json.Marshal(diagnostic)
    rawDiagnostics = append(rawDiagnostics, raw)
  }
  if version != nil {
    versionCopy := *version
    version = &versionCopy
  }
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  previous := p.pluginDiagnostics[uri]
  p.pluginDiagnostics[uri] = cachedDiagnostics{
    version:     version,
    diagnostics: rawDiagnostics,
  }
  return len(previous.diagnostics) > 0
}

func (p *Proxy) augmentInitializeResult(env Envelope) ([]byte, bool) {
  sourceCommands := p.source.CommandIDs()
  commands := p.advertisedCommandIDs(sourceCommands)
  if env.IsErrorResponse() {
    return nil, false
  }
  var result map[string]any
  if err := json.Unmarshal(env.Result, &result); err != nil {
    return nil, false
  }
  if result == nil {
    return nil, false
  }
  caps, ok := result["capabilities"].(map[string]any)
  if !ok || caps == nil {
    caps = map[string]any{}
    result["capabilities"] = caps
  }
  codeActionProvider := caps["codeActionProvider"]
  p.setUpstreamCodeActionProvider(codeActionProvider)
  // Record whether upstream tsgo answers documentSymbol/references itself. The
  // per-method handlers forward to tsgo when it does, so this must be set before
  // the shouldAnswer* checks below read it.
  p.setUpstreamDocumentSymbolProvider(caps["documentSymbolProvider"])
  p.setUpstreamReferencesProvider(caps["referencesProvider"])
  codeActionKinds := p.pluginCodeActionKinds()
  changed := false
  if (len(sourceCommands) > 0 || len(codeActionKinds) > 0) && codeActionProvider == nil {
    caps["codeActionProvider"] = pluginCodeActionProviderValue(codeActionKinds)
    changed = true
  } else if codeActionProviderBool, ok := codeActionProvider.(bool); ok && !codeActionProviderBool && (len(sourceCommands) > 0 || len(codeActionKinds) > 0) {
    caps["codeActionProvider"] = pluginCodeActionProviderValue(codeActionKinds)
    changed = true
  } else if provider, ok := codeActionProvider.(map[string]any); ok && len(codeActionKinds) > 0 {
    provider["codeActionKinds"] = mergeCommandIDs(provider["codeActionKinds"], codeActionKinds)
    caps["codeActionProvider"] = provider
    changed = true
  }
  if len(commands) > 0 {
    provider, _ := caps["executeCommandProvider"].(map[string]any)
    if provider == nil {
      provider = map[string]any{}
    }
    provider["commands"] = mergeCommandIDs(provider["commands"], commands)
    caps["executeCommandProvider"] = provider
    changed = true
  }
  // Merge the plugin's trigger characters into tsgo's completionProvider
  // rather than replacing it. tsgo already advertises `.`, `"`, `'`, backtick,
  // `/`, `@`, `<`, and `#`, and that list is what wakes its own completion —
  // substituting a plugin's would silence the compiler's suggestions to make
  // room for a rule's. When upstream advertises nothing, synthesize the
  // provider so the editor asks at all.
  triggers := p.pluginCompletionTriggerCharacters()
  // Record what the editor ends up being told before the merge rewrites it, so a
  // corpus that arrives after this response can tell whether its trigger already
  // reached the client. Recorded on every initialize, including the one where
  // the corpus is still empty.
  p.rememberAdvertisedCompletionTriggers(caps["completionProvider"], triggers)
  if len(triggers) > 0 {
    provider, _ := caps["completionProvider"].(map[string]any)
    if provider == nil {
      provider = map[string]any{}
    }
    provider["triggerCharacters"] = mergeCommandIDs(provider["triggerCharacters"], triggers)
    caps["completionProvider"] = provider
    changed = true
  }
  // Advertise documentFormattingProvider when ttsc owns the document
  // formatter so editors send textDocument/formatting (formatOnSave). The
  // proxy intercepts that method and formats the live buffer, so it forces
  // the capability on even if upstream tsgo already advertised one — tsgo's
  // formatter would otherwise format the on-disk file and lose unsaved edits.
  if p.ownsCommand(formatDocumentCommand) {
    if existing, ok := caps["documentFormattingProvider"].(bool); !ok || !existing {
      caps["documentFormattingProvider"] = true
      changed = true
    }
  }
  // Advertise documentSymbol/references only when the proxy will actually answer
  // them locally — upstream tsgo did not advertise the capability (fallback) or
  // ForceLocalSymbolProvider is set. When tsgo advertises and the flag is off,
  // the method is forwarded to tsgo, whose own capability already tells the
  // editor to send the request, so its (possibly richer) capability is left
  // untouched here.
  if p.shouldAnswerDocumentSymbolLocally() && !capabilityAdvertised(caps["documentSymbolProvider"]) {
    caps["documentSymbolProvider"] = true
    changed = true
  }
  if p.shouldAnswerReferencesLocally() && !capabilityAdvertised(caps["referencesProvider"]) {
    caps["referencesProvider"] = true
    changed = true
  }
  if !changed {
    return nil, false
  }
  env.Result, _ = json.Marshal(result)
  body, _ := json.Marshal(env)
  return body, true
}

func (p *Proxy) advertisedCommandIDs(commands []string) []string {
  if p.suppressExecuteCommandProvider || len(commands) == 0 {
    return nil
  }
  out := make([]string, 0, len(commands))
  for _, command := range commands {
    if p.shouldAdvertiseCommandID(command) {
      out = append(out, p.advertisedCommandID(command))
    }
  }
  return out
}

func (p *Proxy) shouldAdvertiseCommandID(command string) bool {
  if p.suppressExecuteCommandProvider || command == "" {
    return false
  }
  _, suppressed := p.suppressedExecuteCommandIDs[command]
  return !suppressed
}

func (p *Proxy) advertisedCommandID(command string) string {
  if p.executeCommandIDPrefix == "" {
    return command
  }
  return p.executeCommandIDPrefix + command
}

func (p *Proxy) rewriteCodeActionCommands(actions []LSPCodeAction) []LSPCodeAction {
  if len(actions) == 0 || p.executeCommandIDPrefix == "" {
    return actions
  }
  rewritten := make([]LSPCodeAction, len(actions))
  for i, action := range actions {
    rewritten[i] = p.rewriteCodeActionCommand(action)
  }
  return rewritten
}

func (p *Proxy) rewriteCodeActionCommand(action LSPCodeAction) LSPCodeAction {
  if action.Command == nil ||
    p.executeCommandIDPrefix == "" ||
    !p.ownsCommand(action.Command.Command) ||
    !p.shouldAdvertiseCommandID(action.Command.Command) {
    return action
  }
  command := *action.Command
  command.Command = p.advertisedCommandID(command.Command)
  action.Command = &command
  return action
}

func commandIDSet(commands []string) map[string]struct{} {
  if len(commands) == 0 {
    return nil
  }
  out := make(map[string]struct{}, len(commands))
  for _, command := range commands {
    if command != "" {
      out[command] = struct{}{}
    }
  }
  return out
}

func pluginCodeActionProviderValue(kinds []string) any {
  if len(kinds) == 0 {
    return true
  }
  return map[string]any{
    "codeActionKinds": mergeCommandIDs(nil, kinds),
  }
}

func (p *Proxy) pluginCodeActionKinds() []string {
  type codeActionKindSource interface {
    CodeActionKinds() []string
  }
  if source, ok := p.source.(codeActionKindSource); ok {
    return source.CodeActionKinds()
  }
  return nil
}

// pluginCompletionHints returns the corpus a plugin published, or nil when the
// source does not offer one.
//
// Optional-interface assertion for the same reason CodeActionKinds uses it: a
// PluginSource that predates this — NullPluginSource included — must keep
// compiling and must contribute nothing rather than break.
func (p *Proxy) pluginCompletionHints() []LSPCompletionHint {
  type completionHintSource interface {
    CompletionHints() []LSPCompletionHint
  }
  if source, ok := p.source.(completionHintSource); ok {
    return source.CompletionHints()
  }
  return nil
}

// pluginCompletionTriggerCharacters returns the characters that should wake the
// editor for a plugin hint.
//
// The last character of each After is what the user types to reach the hint, so
// that is what must be advertised. These are MERGED into whatever tsgo already
// advertises, never substituted: tsgo's own list drives its completion, and
// replacing it would silence the compiler's suggestions to make room for a
// plugin's.
func (p *Proxy) pluginCompletionTriggerCharacters() []string {
  hints := p.pluginCompletionHints()
  characters := make([]string, 0, len(hints))
  for _, hint := range hints {
    if hint.After == "" {
      continue
    }
    trigger, _ := utf8.DecodeLastRuneInString(hint.After)
    characters = append(characters, string(trigger))
  }
  return characters
}

// refreshPluginCompletionHints asks the source to rediscover its corpus after an
// editor event that can invalidate it. Optional-interface assertion for the same
// reason pluginCompletionHints uses one: a source with no corpus to refresh —
// NullPluginSource, or one built before this — is simply unaffected.
//
// The call returns immediately; the source owns the scheduling, coalescing, and
// staleness rules, so the editor's notification is never held behind a plugin.
func (p *Proxy) refreshPluginCompletionHints() {
  type completionHintRefresher interface {
    RefreshCompletionHints()
  }
  if source, ok := p.source.(completionHintRefresher); ok {
    source.RefreshCompletionHints()
  }
}

// completionHintsRefreshed runs after the source finishes a corpus refresh.
//
// Items from the new corpus need nothing here: completion reads the corpus per
// request, so a refreshed corpus is live the moment it is stored. Trigger
// characters are the exception. They were merged into the initialize response,
// which the editor has already consumed, and LSP's only way to change them
// afterwards is client/registerCapability — which in VS Code adds a SECOND
// completion provider beside the static one instead of amending it, so every
// item tsgo returns would be offered twice. Rather than corrupt the compiler's
// own list to advertise a character, the proxy says once, per character, that
// this one needs a restart. Everything else about the hint already works: the
// items appear on Ctrl+Space and after any trigger the editor already knows.
func (p *Proxy) completionHintsRefreshed() {
  for _, character := range p.takeUnadvertisedCompletionTriggers() {
    p.reportAsyncError(p.writeLateCompletionTriggerNotice(character))
  }
}

// takeUnadvertisedCompletionTriggers returns the corpus trigger characters the
// editor was never told about, marking each as reported so a later refresh that
// still carries it stays quiet. Nothing is reported before the editor has the
// initialize response, because until then every trigger is still in time.
func (p *Proxy) takeUnadvertisedCompletionTriggers() []string {
  triggers := p.pluginCompletionTriggerCharacters()
  if len(triggers) == 0 {
    return nil
  }
  p.capabilityMu.Lock()
  defer p.capabilityMu.Unlock()
  if !p.initializeAnswered {
    return nil
  }
  var late []string
  for _, character := range triggers {
    if _, advertised := p.advertisedCompletionTriggers[character]; advertised {
      continue
    }
    if _, reported := p.reportedCompletionTriggers[character]; reported {
      continue
    }
    if p.reportedCompletionTriggers == nil {
      p.reportedCompletionTriggers = map[string]struct{}{}
    }
    p.reportedCompletionTriggers[character] = struct{}{}
    late = append(late, character)
  }
  return late
}

// rememberAdvertisedCompletionTriggers records the completion trigger set the
// editor is about to receive: upstream tsgo's characters plus the ones the
// corpus contributed while initialize was in flight. Recorded even when the
// corpus added nothing, because that is exactly the session where a later
// refresh has something new to say.
func (p *Proxy) rememberAdvertisedCompletionTriggers(upstream any, added []string) {
  advertised := map[string]struct{}{}
  if provider, ok := upstream.(map[string]any); ok {
    if existing, ok := provider["triggerCharacters"].([]any); ok {
      for _, value := range existing {
        if character, ok := value.(string); ok && character != "" {
          advertised[character] = struct{}{}
        }
      }
    }
  }
  for _, character := range added {
    if character != "" {
      advertised[character] = struct{}{}
    }
  }
  p.capabilityMu.Lock()
  defer p.capabilityMu.Unlock()
  p.advertisedCompletionTriggers = advertised
  p.initializeAnswered = true
}

// writeLateCompletionTriggerNotice tells the editor's output channel that one
// trigger character arrived too late to be advertised. window/logMessage rather
// than window/showMessage: this is a state the user may want to act on, not an
// interruption of what they are doing.
func (p *Proxy) writeLateCompletionTriggerNotice(character string) error {
  params, err := json.Marshal(map[string]any{
    "type": lspMessageTypeInfo,
    "message": fmt.Sprintf(
      "ttscserver: a plugin now publishes completion after %q, which was not advertised when this session started. "+
        "The items are available on explicit completion (Ctrl+Space); restart the language server to have the editor open them on that character.",
      character,
    ),
  })
  if err != nil {
    return nil
  }
  body, err := json.Marshal(Envelope{JSONRPC: "2.0", Method: methodLogMessage, Params: params})
  if err != nil {
    return nil
  }
  return p.writeEditorFrame(body)
}

func (p *Proxy) setUpstreamCodeActionProvider(value any) {
  provides := true
  if boolValue, ok := value.(bool); ok {
    provides = boolValue
  } else if value == nil {
    provides = false
  }
  p.capabilityMu.Lock()
  defer p.capabilityMu.Unlock()
  p.upstreamCodeActionProvider = provides
}

func (p *Proxy) setUpstreamDocumentSymbolProvider(value any) {
  p.capabilityMu.Lock()
  defer p.capabilityMu.Unlock()
  p.upstreamDocumentSymbolProvider = capabilityAdvertised(value)
}

func (p *Proxy) setUpstreamReferencesProvider(value any) {
  p.capabilityMu.Lock()
  defer p.capabilityMu.Unlock()
  p.upstreamReferencesProvider = capabilityAdvertised(value)
}

// shouldAnswerDocumentSymbolLocally reports whether the proxy answers
// textDocument/documentSymbol from the local SymbolProvider instead of
// forwarding to upstream tsgo: a provider must be wired, and either the caller
// forced it or tsgo did not advertise the capability.
func (p *Proxy) shouldAnswerDocumentSymbolLocally() bool {
  if p.symbolProvider == nil {
    return false
  }
  if p.forceLocalSymbolProvider {
    return true
  }
  p.capabilityMu.Lock()
  defer p.capabilityMu.Unlock()
  return !p.upstreamDocumentSymbolProvider
}

// shouldAnswerReferencesLocally mirrors shouldAnswerDocumentSymbolLocally for
// textDocument/references.
func (p *Proxy) shouldAnswerReferencesLocally() bool {
  if p.symbolProvider == nil {
    return false
  }
  if p.forceLocalSymbolProvider {
    return true
  }
  p.capabilityMu.Lock()
  defer p.capabilityMu.Unlock()
  return !p.upstreamReferencesProvider
}

// invalidateSymbolProvider drops the SymbolProvider's cached compiler state so
// the next documentSymbol/references request reflects the latest sources. It is
// a no-op when no provider is wired.
func (p *Proxy) invalidateSymbolProvider() {
  if p.symbolProvider != nil {
    p.symbolProvider.Invalidate()
  }
}

// invalidateResidentPlugins tells a resident plugin source that a document
// changed on disk, passing the saved document's URI so the daemon can update
// that file incrementally; an unparseable notification falls back to a full
// invalidation. Optional-interface assertion for the same reason
// pluginCodeActionKinds uses one: a PluginSource without a resident daemon
// (NullPluginSource, or one built before this) is simply unaffected.
func (p *Proxy) invalidateResidentPlugins(env Envelope) {
  source, ok := p.residentInvalidator()
  if !ok {
    return
  }
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
  }
  if len(env.Params) > 0 && json.Unmarshal(env.Params, &params) == nil && params.TextDocument.URI != "" {
    source.InvalidateResidentPrograms(params.TextDocument.URI)
    return
  }
  source.InvalidateResidentPrograms()
}

// residentInvalidator is the optional capability a PluginSource exposes to
// refresh its warm compiler state. Optional-interface assertion for the same
// reason pluginCodeActionKinds uses one: a PluginSource without a resident
// daemon (NullPluginSource, or one built before this) is simply unaffected.
type residentInvalidator interface {
  InvalidateResidentPrograms(...string)
}

func (p *Proxy) residentInvalidator() (residentInvalidator, bool) {
  source, ok := p.source.(residentInvalidator)
  return source, ok
}

// invalidateResidentPluginsForURIs names the documents that changed on disk so
// the daemon updates exactly those files incrementally. Calling it with no URI
// is the deliberate full-reload request for a change the host cannot localize.
func (p *Proxy) invalidateResidentPluginsForURIs(uris ...string) {
  if source, ok := p.residentInvalidator(); ok {
    source.InvalidateResidentPrograms(uris...)
  }
}

type watchedResidentInvalidator interface {
  InvalidateResidentProgramsForWatchedChanges(
    changedURIs []string,
    externalURIs []string,
  )
}

type ownedWatchedResidentInvalidator interface {
  InvalidateResidentProgramsForOwnedWatchedChanges(
    changedURIs []string,
    externalURIs []string,
    externalOwners map[string][]string,
  )
}

func (p *Proxy) invalidateResidentPluginsForWatchedChanges(
  changedURIs []string,
  externalURIs []string,
  externalOwners map[string][]string,
) {
  if source, ok := p.source.(ownedWatchedResidentInvalidator); ok {
    source.InvalidateResidentProgramsForOwnedWatchedChanges(
      changedURIs,
      externalURIs,
      externalOwners,
    )
    return
  }
  if source, ok := p.source.(watchedResidentInvalidator); ok {
    source.InvalidateResidentProgramsForWatchedChanges(
      changedURIs,
      externalURIs,
    )
    return
  }
  p.invalidateResidentPluginsForURIs(changedURIs...)
}

// LSP FileChangeType. Only `changed` names an edit to a file whose place in the
// project is unchanged; created and deleted both reshape the root set, which a
// per-file UpdateProgram cannot express.
const (
  fileChangeTypeCreated = 1
  fileChangeTypeChanged = 2
  fileChangeTypeDeleted = 3
)

// invalidateForWatchedFileChanges refreshes both compiler-backed caches for a
// workspace/didChangeWatchedFiles batch, which is the only notification carrying
// an on-disk change to a file the editor does not have open.
//
// A batch the proxy can localize — every entry a plain `changed` event on a file
// that is not project configuration — travels as changed URIs so the daemon
// re-parses just those files. Anything else drops the warm Program wholesale:
// a created or deleted file changes the root set, and a tsconfig/jsconfig edit
// changes the compiler options and the file selection, neither of which a
// per-file update can express. A batch the proxy cannot decode is treated the
// same conservative way, because an unread change is indistinguishable from an
// unlocalizable one.
//
// A deleted document additionally withdraws whatever ttsc last published for it,
// because refreshing the Program alone would leave the findings on screen: an
// open document's content belongs to the client rather than to disk, so the
// compiler has no reason to republish for that URI and trigger the merge that
// would replace them.
func (p *Proxy) invalidateForWatchedFileChanges(env Envelope) error {
  var params struct {
    Changes []struct {
      URI  string `json:"uri"`
      Type *int   `json:"type"`
    } `json:"changes"`
  }
  if len(env.Params) == 0 || json.Unmarshal(env.Params, &params) != nil {
    p.invalidateSymbolProvider()
    p.invalidateResidentPluginsForURIs()
    p.refreshPluginCompletionHints()
    return nil
  }
  if len(params.Changes) == 0 {
    // The editor reported no change; dropping warm state here would throw away
    // the residency the daemon exists to provide for nothing. A corpus refresh
    // is skipped for the same reason and at higher cost: it spawns a sidecar
    // per plugin, each loading its own Program.
    return nil
  }
  uris := make([]string, 0, len(params.Changes))
  externalURIs := make([]string, 0, len(params.Changes))
  externalSet := make(map[string]struct{}, len(params.Changes))
  externalOwners := make(map[string][]string, len(params.Changes))
  affectedProjectDiagnosticOwners := map[string]struct{}{}
  allProjectDiagnosticOwners := false
  deleted := make([]string, 0, len(params.Changes))
  localizable := true
  for _, change := range params.Changes {
    if change.URI != "" && change.Type != nil && *change.Type == fileChangeTypeDeleted {
      deleted = append(deleted, change.URI)
    }
    ownerScope, matched := p.projectInputOwnerScope(change.URI)
    if matched {
      externalSet[change.URI] = struct{}{}
      if ownerScope.all {
        allProjectDiagnosticOwners = true
        externalOwners[change.URI] = nil
      } else {
        owners := ownerScope.list()
        externalOwners[change.URI] = owners
        for _, owner := range owners {
          affectedProjectDiagnosticOwners[owner] = struct{}{}
        }
      }
      if externalWatchedChangeRetainsProgram(change.URI, change.Type) {
        externalURIs = append(externalURIs, change.URI)
        uris = append(uris, change.URI)
      } else {
        localizable = false
      }
      continue
    }
    if !watchedFileChangeIsLocalizable(change.URI, change.Type) {
      localizable = false
      continue
    }
    uris = append(uris, change.URI)
  }
  p.invalidateSymbolProvider()
  if !localizable || len(uris) == 0 {
    p.invalidateResidentPluginsForURIs()
  } else {
    p.invalidateResidentPluginsForWatchedChanges(
      uris,
      externalURIs,
      externalOwners,
    )
  }
  // A completion corpus projects the whole Program, so it cannot be invalidated
  // per URI the way the resident daemon's is: any reported change can change it.
  if len(externalSet) > 0 || watchedChangesMayAffectProgram(params.Changes) {
    p.refreshPluginCompletionHints()
  }
  if len(externalSet) > 0 {
    p.refreshProjectInputs()
    p.scheduleProjectDiagnosticRefresh(projectDiagnosticOwnerScope{
      all:    allProjectDiagnosticOwners,
      owners: affectedProjectDiagnosticOwners,
    })
  }
  for _, uri := range deleted {
    if err := p.withdrawPluginDiagnosticsForDeletedDocument(uri); err != nil {
      return err
    }
  }
  return nil
}

// withdrawPluginDiagnosticsForDeletedDocument removes ttsc's findings for a
// document that no longer exists on disk and republishes what remains, so a
// deleted file cannot keep a plugin squiggle from the last time it was linted.
//
// Upstream diagnostics are left in place: the compiler owns its own answer for
// the same document, and the editor may legitimately keep showing it while the
// buffer is still open. Bumping the diagnostic generation discards any in-flight
// computation started against the pre-deletion Program. A document ttsc never
// published for is a no-op, which is the ordinary case.
func (p *Proxy) withdrawPluginDiagnosticsForDeletedDocument(uri string) error {
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  if len(p.pluginDiagnostics[uri].diagnostics) == 0 {
    return nil
  }
  delete(p.pluginDiagnostics, uri)
  p.diagnosticGeneration[uri]++
  return WriteFrame(p.editorOut, p.publishDiagnosticsBody(uri, nil, p.mergedDiagnosticsLocked(uri)))
}

// watchedFileChangeIsLocalizable reports whether one watched-file entry can be
// delivered to the resident daemon as a changed URI, rather than forcing it to
// drop the warm Program and reload.
func watchedFileChangeIsLocalizable(uri string, changeType *int) bool {
  if uri == "" || changeType == nil {
    return false
  }
  switch *changeType {
  case fileChangeTypeChanged:
    // A configuration edit can change the compiler options and the selected root
    // files at once, which is not a single-file update however it is spelled.
    return !isProjectConfigURI(uri)
  case fileChangeTypeCreated, fileChangeTypeDeleted:
    // The root set moved, which tsgo's per-file UpdateProgram cannot express.
    return false
  default:
    // A FileChangeType outside the enum LSP defines.
    return false
  }
}

type projectInputMatcher interface {
  ProjectInputMatchesURI(string) bool
}

type projectInputOwnerMatcher interface {
  ProjectInputOwnersForURI(string) []string
}

type projectDiagnosticOwnerScope struct {
  all    bool
  owners map[string]struct{}
}

func (scope projectDiagnosticOwnerScope) list() []string {
  owners := make([]string, 0, len(scope.owners))
  for owner := range scope.owners {
    owners = append(owners, owner)
  }
  sort.Strings(owners)
  return owners
}

func (p *Proxy) projectInputOwnerScope(
  uri string,
) (projectDiagnosticOwnerScope, bool) {
  if source, ok := p.source.(projectInputOwnerMatcher); ok {
    owners := source.ProjectInputOwnersForURI(uri)
    if len(owners) != 0 {
      scope := projectDiagnosticOwnerScope{owners: map[string]struct{}{}}
      for _, owner := range owners {
        scope.owners[owner] = struct{}{}
      }
      return scope, true
    }
  }
  source, ok := p.source.(projectInputMatcher)
  if !ok || !source.ProjectInputMatchesURI(uri) {
    return projectDiagnosticOwnerScope{}, false
  }
  return projectDiagnosticOwnerScope{all: true}, true
}

func (p *Proxy) refreshProjectInputs() {
  type projectInputRefresher interface {
    RefreshProjectInputs()
  }
  if source, ok := p.source.(projectInputRefresher); ok {
    source.RefreshProjectInputs()
  }
}

type projectDiagnosticsSource interface {
  ProjectDiagnostics() *LSPProjectDiagnostics
}

type ownedProjectDiagnosticsSource interface {
  ProjectDiagnosticsForOwners([]string) projectDiagnosticsRefreshResult
}

// scheduleProjectDiagnosticRefresh debounces external-input events and
// invalidates the prior generation immediately. One in-flight computation may
// finish, but its generation can no longer publish after a newer event.
func (p *Proxy) scheduleProjectDiagnosticRefresh(
  scope projectDiagnosticOwnerScope,
) {
  if _, owned := p.source.(ownedProjectDiagnosticsSource); !owned {
    if _, legacy := p.source.(projectDiagnosticsSource); !legacy {
      return
    }
  }
  if !scope.all && len(scope.owners) == 0 {
    if _, owned := p.source.(ownedProjectDiagnosticsSource); !owned {
      return
    }
  }
  p.diagnosticsMu.Lock()
  p.projectDiagnosticGeneration++
  generation := p.projectDiagnosticGeneration
  p.diagnosticsMu.Unlock()

  p.projectRefreshMu.Lock()
  p.pendingProjectDiagnosticGeneration = generation
  p.projectDiagnosticRefreshPending = true
  if scope.all {
    p.pendingProjectDiagnosticAllOwners = true
    p.pendingProjectDiagnosticOwners = nil
  } else if !p.pendingProjectDiagnosticAllOwners {
    if p.pendingProjectDiagnosticOwners == nil {
      p.pendingProjectDiagnosticOwners = map[string]struct{}{}
    }
    for owner := range scope.owners {
      p.pendingProjectDiagnosticOwners[owner] = struct{}{}
    }
  }
  if p.projectRefreshTimer != nil {
    p.projectRefreshTimer.Stop()
  }
  p.projectRefreshTimer = time.AfterFunc(60*time.Millisecond, func() {
    p.projectDiagnosticsRefresh.schedule(
      p.refreshProjectDiagnostics,
    )
  })
  p.projectRefreshMu.Unlock()
}

func (p *Proxy) pendingProjectDiagnosticScopeLocked() projectDiagnosticOwnerScope {
  scope := projectDiagnosticOwnerScope{
    all:    p.pendingProjectDiagnosticAllOwners,
    owners: map[string]struct{}{},
  }
  for owner := range p.pendingProjectDiagnosticOwners {
    scope.owners[owner] = struct{}{}
  }
  return scope
}

func (p *Proxy) pendingProjectDiagnosticOwnersRefreshed(
  refreshed map[string]struct{},
) bool {
  p.projectRefreshMu.Lock()
  defer p.projectRefreshMu.Unlock()
  if !p.projectDiagnosticRefreshPending ||
    p.pendingProjectDiagnosticAllOwners ||
    len(p.pendingProjectDiagnosticOwners) == 0 {
    return false
  }
  for owner := range p.pendingProjectDiagnosticOwners {
    if _, ok := refreshed[owner]; !ok {
      return false
    }
  }
  return true
}

func (p *Proxy) refreshProjectDiagnostics(uint64) {
  p.projectRefreshMu.Lock()
  generation := p.pendingProjectDiagnosticGeneration
  pending := p.projectDiagnosticRefreshPending
  scope := p.pendingProjectDiagnosticScopeLocked()
  p.projectRefreshMu.Unlock()
  if !pending {
    return
  }
  if p.hasDirtyDocuments() {
    return
  }
  refresh := projectDiagnosticsRefreshResult{complete: true}
  if source, ok := p.source.(ownedProjectDiagnosticsSource); ok {
    owners := scope.list()
    if scope.all {
      owners = nil
    }
    refresh = source.ProjectDiagnosticsForOwners(owners)
  } else if source, ok := p.source.(projectDiagnosticsSource); ok {
    refresh.publication = source.ProjectDiagnostics()
    refresh.complete =
      refresh.publication != nil && refresh.publication.URI != ""
    refresh.selected = 1
  } else {
    return
  }
  if refresh.selected == 0 {
    if refresh.complete {
      p.completePendingProjectDiagnosticRefresh(generation)
    }
    return
  }
  if refresh.publication == nil || refresh.publication.URI == "" {
    return
  }
  // The editor can retain a project diagnostic from before this proxy
  // generation. An external-input refresh therefore publishes an explicit
  // empty replacement even when the in-process cache was already empty.
  writeResult, err := p.writeProjectDiagnosticsIfCurrent(
    refresh.publication,
    generation,
    true,
  )
  p.reportAsyncError(err)
  if err != nil || p.hasDirtyDocuments() {
    return
  }
  if writeResult.frameWritten {
    if refresh.complete {
      p.completePendingProjectDiagnosticRefresh(generation)
    }
    return
  }
  // A document diagnostics request may have advanced the project generation
  // without publishing project diagnostics, for example when parse diagnostics
  // caused the sidecar to omit its project result. Retain and rerun the direct
  // refresh instead of treating that rejected write as a successful clear.
  if !writeResult.accepted {
    p.resumePendingProjectDiagnosticRefresh()
  }
}

func (p *Proxy) completePendingProjectDiagnosticRefresh(generation uint64) {
  p.projectRefreshMu.Lock()
  defer p.projectRefreshMu.Unlock()
  if !p.projectDiagnosticRefreshPending ||
    generation < p.pendingProjectDiagnosticGeneration {
    return
  }
  p.projectDiagnosticRefreshPending = false
  p.pendingProjectDiagnosticAllOwners = false
  p.pendingProjectDiagnosticOwners = nil
  if p.projectRefreshTimer != nil {
    p.projectRefreshTimer.Stop()
    p.projectRefreshTimer = nil
  }
}

func (p *Proxy) stopProjectDiagnosticRefresh() {
  p.projectRefreshMu.Lock()
  defer p.projectRefreshMu.Unlock()
  if p.projectRefreshTimer != nil {
    p.projectRefreshTimer.Stop()
    p.projectRefreshTimer = nil
  }
  p.projectDiagnosticRefreshPending = false
  p.pendingProjectDiagnosticAllOwners = false
  p.pendingProjectDiagnosticOwners = nil
}

func (p *Proxy) resumePendingProjectDiagnosticRefresh() {
  if p.hasDirtyDocuments() {
    return
  }
  p.projectRefreshMu.Lock()
  pending := p.projectDiagnosticRefreshPending
  scope := p.pendingProjectDiagnosticScopeLocked()
  p.projectRefreshMu.Unlock()
  if pending {
    p.scheduleProjectDiagnosticRefresh(scope)
  }
}

func (p *Proxy) hasDirtyDocuments() bool {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  return len(p.dirtyDocuments) > 0
}

func watchedChangesMayAffectProgram(changes []struct {
  URI  string `json:"uri"`
  Type *int   `json:"type"`
}) bool {
  for _, change := range changes {
    if isProjectConfigURI(change.URI) {
      return true
    }
    if watchedURIHasProgramSourceExtension(change.URI) {
      return true
    }
  }
  return false
}

func externalWatchedChangeRetainsProgram(
  uri string,
  changeType *int,
) bool {
  if uri == "" || changeType == nil || isProjectConfigURI(uri) {
    return false
  }
  if _, ok := filePathFromURI(uri); !ok {
    return false
  }
  switch *changeType {
  case fileChangeTypeChanged:
    return true
  case fileChangeTypeCreated, fileChangeTypeDeleted:
    // A declared path may also satisfy a compiler root, module resolution, or
    // another compiler-recognized extension. Only those membership changes
    // cold-load the Program; data-only topology remains safely localizable.
    return !watchedURIHasProgramSourceExtension(uri)
  default:
    return false
  }
}

func watchedURIHasProgramSourceExtension(uri string) bool {
  location, ok := filePathFromURI(uri)
  if !ok {
    return false
  }
  switch strings.ToLower(filepath.Ext(location)) {
  case ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs":
    return true
  default:
    return false
  }
}

// isProjectConfigURI reports whether uri names a TypeScript project
// configuration file — `tsconfig.json`, `jsconfig.json`, and the
// `tsconfig.<name>.json` spellings the VS Code client watches. Such an edit can
// change the compiler options and the root file set at once, so it is never
// localizable to a single source file.
func isProjectConfigURI(uri string) bool {
  path := uri
  if parsed, err := url.Parse(uri); err == nil && parsed.Path != "" {
    path = parsed.Path
  }
  name := strings.ToLower(path)
  if index := strings.LastIndexAny(name, "/\\"); index >= 0 {
    name = name[index+1:]
  }
  if !strings.HasSuffix(name, ".json") {
    return false
  }
  return strings.HasPrefix(name, "tsconfig") || strings.HasPrefix(name, "jsconfig")
}

// shutdownResidentPlugins kills any resident plugin daemons on server teardown.
// The children also exit on their own when the parent closes their stdin at
// process exit, so this is the graceful path, not the only one.
func (p *Proxy) shutdownResidentPlugins() {
  type residentShutdown interface{ shutdownResidents() }
  if source, ok := p.source.(residentShutdown); ok {
    source.shutdownResidents()
  }
}

// capabilityAdvertised reports whether an LSP server-capability value means the
// server implements the capability: boolean true, or an options object. Absent
// (nil), false, or any other shape counts as unsupported.
func capabilityAdvertised(value any) bool {
  switch v := value.(type) {
  case bool:
    return v
  case map[string]any:
    return v != nil
  default:
    return false
  }
}

func mergeCommandIDs(existing any, additions []string) []string {
  seen := map[string]struct{}{}
  out := make([]string, 0, len(additions))
  switch list := existing.(type) {
  case []any:
    for _, value := range list {
      if id, ok := value.(string); ok && id != "" {
        seen[id] = struct{}{}
        out = append(out, id)
      }
    }
  case []string:
    for _, id := range list {
      if id != "" {
        seen[id] = struct{}{}
        out = append(out, id)
      }
    }
  }
  for _, id := range additions {
    if id == "" {
      continue
    }
    if _, ok := seen[id]; ok {
      continue
    }
    seen[id] = struct{}{}
    out = append(out, id)
  }
  return out
}

func (p *Proxy) rememberUpstreamDiagnostics(uri string, version *int, diagnostics []json.RawMessage) {
  if uri == "" {
    return
  }
  copied := make([]json.RawMessage, len(diagnostics))
  for i, diagnostic := range diagnostics {
    copied[i] = append(json.RawMessage(nil), diagnostic...)
  }
  if version != nil {
    versionCopy := *version
    version = &versionCopy
  }
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  p.upstreamDiagnostics[uri] = cachedDiagnostics{
    version:     version,
    diagnostics: copied,
  }
}

func copyIntPtr(value *int) *int {
  if value == nil {
    return nil
  }
  copied := *value
  return &copied
}

func copyRawDiagnostics(diagnostics []json.RawMessage) []json.RawMessage {
  copied := make([]json.RawMessage, len(diagnostics))
  for i, diagnostic := range diagnostics {
    copied[i] = append(json.RawMessage(nil), diagnostic...)
  }
  return copied
}

// appendCodeActions adds ttsc-owned code actions to a forwarded
// codeAction response. The response body is either an array of actions
// or null; we preserve that shape so editors that special-case null
// keep working. The function refuses to splice into error responses
// (JSON-RPC §5.1 forbids both `result` and `error` on the same frame)
// and into non-array results (the LSP base protocol mandates an array
// or null for codeAction; anything else means upstream returned a
// shape ttsc cannot splice into, so the proxy forwards verbatim
// rather than corrupting it).
func (p *Proxy) appendCodeActions(env Envelope, pending pendingCodeActionRequest) ([]byte, bool) {
  if env.IsErrorResponse() {
    return nil, false
  }
  if !p.isDocumentCleanAt(pending.uri, pending.generation) {
    return nil, false
  }
  trimmed := bytes.TrimSpace(env.Result)
  if len(trimmed) > 0 && trimmed[0] != '[' && !bytes.Equal(trimmed, []byte("null")) {
    return nil, false
  }
  actions := p.source.CodeActions(pending.uri, pending.rng, pending.ctx)
  if !p.isDocumentCleanAt(pending.uri, pending.generation) {
    return nil, false
  }
  if len(actions) == 0 {
    return nil, false
  }
  var existing []json.RawMessage
  if len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null")) {
    _ = json.Unmarshal(trimmed, &existing)
  }
  for _, action := range actions {
    action = p.rewriteCodeActionCommand(action)
    raw, _ := json.Marshal(action)
    existing = append(existing, raw)
  }
  env.Result, _ = json.Marshal(existing)
  body, _ := json.Marshal(env)
  return body, true
}

// writeEditorFrame serializes body under writeMu so concurrent calls from
// pumpEditorToUpstream (local command responses) and pumpUpstreamToEditor
// (forwarded upstream frames) do not interleave partial writes.
func (p *Proxy) writeEditorFrame(body []byte) error {
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  return WriteFrame(p.editorOut, body)
}

func (p *Proxy) writeUpstreamFrame(body []byte) error {
  p.upstreamWriteMu.Lock()
  defer p.upstreamWriteMu.Unlock()
  return WriteFrame(p.upstreamIn, body)
}

func (p *Proxy) reportAsyncError(err error) {
  if err == nil || errors.Is(err, ErrFrameClosed) || errors.Is(err, context.Canceled) {
    return
  }
  select {
  case p.asyncErrCh <- err:
  default:
  }
}

// writeResult sends a JSON-RPC success response with the given result to
// the editor. A nil result is marshalled as JSON null.
func (p *Proxy) writeResult(id json.RawMessage, result any) error {
  rawResult, _ := json.Marshal(result)
  env := Envelope{JSONRPC: "2.0", ID: id, Result: rawResult}
  body, _ := json.Marshal(env)
  return p.writeEditorFrame(body)
}

func (p *Proxy) writeExecuteCommandResultIfClean(id json.RawMessage, pending pendingExecuteCommandRequest, edit *LSPWorkspaceEdit) error {
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  dirty := p.documentGenerationsChangedLocked(pending.argumentGenerations) ||
    p.argumentsContainDirtyDocumentLocked(pending.args) ||
    p.workspaceEditTargetsChangedLocked(edit, pending.documentGenerations) ||
    p.workspaceEditTargetsDirtyDocumentLocked(edit)
  if dirty || edit == nil {
    return p.writeResultLocked(id, nil)
  }
  return p.writeResultLocked(id, edit)
}

func (p *Proxy) writeExecuteCommandErrorIfClean(id json.RawMessage, pending pendingExecuteCommandRequest, message string) error {
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  stale := p.documentGenerationsChangedLocked(pending.argumentGenerations) ||
    p.argumentsContainDirtyDocumentLocked(pending.args)
  if len(pending.argumentGenerations) == 0 {
    stale = p.documentGenerationsChangedLocked(pending.documentGenerations)
  }
  if stale {
    return p.writeResultLocked(id, nil)
  }
  return p.writeErrorLocked(id, message)
}

func (p *Proxy) writeResultLocked(id json.RawMessage, result any) error {
  rawResult, _ := json.Marshal(result)
  env := Envelope{JSONRPC: "2.0", ID: id, Result: rawResult}
  body, _ := json.Marshal(env)
  return WriteFrame(p.editorOut, body)
}

// jsonRPCInternalError is the JSON-RPC 2.0 reserved error code for
// "Internal error" (spec §5.1).
const jsonRPCInternalError = -32603

// writeError sends a JSON-RPC error response to the editor. message is
// embedded verbatim in the error object; callers are responsible for
// keeping it concise and safe to surface in editor UI.
func (p *Proxy) writeError(id json.RawMessage, message string) error {
  p.writeMu.Lock()
  defer p.writeMu.Unlock()
  return p.writeErrorLocked(id, message)
}

func (p *Proxy) writeErrorLocked(id json.RawMessage, message string) error {
  errPayload, _ := json.Marshal(struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
  }{Code: jsonRPCInternalError, Message: message})
  env := Envelope{JSONRPC: "2.0", ID: id, Error: errPayload}
  body, _ := json.Marshal(env)
  return WriteFrame(p.editorOut, body)
}
