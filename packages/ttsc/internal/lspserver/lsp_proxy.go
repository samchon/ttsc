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
  "strings"
  "sync"
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
)

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

  writeMu         sync.Mutex // serializes WriteFrame calls to editorOut
  upstreamWriteMu sync.Mutex // serializes writes to upstreamIn
  asyncErrCh      chan error

  pendingMu                sync.Mutex
  pendingActions           map[string]pendingCodeActionRequest
  pendingAugmentingActions map[string]struct{}
  pendingLocalActions      map[string]struct{}
  pendingCommands          map[string]struct{}
  pendingInitialize        map[string]struct{}

  capabilityMu               sync.Mutex
  upstreamCodeActionProvider bool

  diagnosticsMu        sync.Mutex
  upstreamDiagnostics  map[string]cachedDiagnostics
  pluginDiagnostics    map[string]cachedDiagnostics
  diagnosticGeneration map[string]uint64
  documentGeneration   map[string]uint64
  dirtyDocuments       map[string]struct{}
  dirtyVersions        map[string]*int
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
  return &Proxy{
    editorIn:                       opts.EditorIn,
    editorOut:                      opts.EditorOut,
    upstreamIn:                     opts.UpstreamIn,
    upstreamOut:                    opts.UpstreamOut,
    source:                         source,
    suppressExecuteCommandProvider: opts.SuppressExecuteCommandProvider,
    suppressedExecuteCommandIDs:    commandIDSet(opts.SuppressedExecuteCommandIDs),
    executeCommandIDPrefix:         opts.ExecuteCommandIDPrefix,
    asyncErrCh:                     make(chan error, 1),
    pendingActions:                 make(map[string]pendingCodeActionRequest),
    pendingAugmentingActions:       make(map[string]struct{}),
    pendingLocalActions:            make(map[string]struct{}),
    pendingCommands:                make(map[string]struct{}),
    pendingInitialize:              make(map[string]struct{}),
    upstreamCodeActionProvider:     true,
    upstreamDiagnostics:            make(map[string]cachedDiagnostics),
    pluginDiagnostics:              make(map[string]cachedDiagnostics),
    diagnosticGeneration:           make(map[string]uint64),
    documentGeneration:             make(map[string]uint64),
    dirtyDocuments:                 make(map[string]struct{}),
    dirtyVersions:                  make(map[string]*int),
  }
}

// Run drives both pump goroutines until they return. Pumps return when
// their input stream closes (ErrFrameClosed), when context cancellation
// has already been observed by the upstream/editor closers, or when a
// pipe write fails. ErrFrameClosed and context.Canceled are folded into
// a nil result so editor shutdown does not look like a crash.
func (p *Proxy) Run(ctx context.Context) error {
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
    if err := p.writeUpstreamFrame(body); err != nil {
      return err
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
  switch env.Method {
  case methodInitialize:
    if env.IsRequest() {
      p.rememberInitializeRequest(env)
    }
  case methodDidOpen:
    if env.IsNotification() {
      if err := p.publishPluginDiagnosticsForDidOpen(env); err != nil {
        return false, err
      }
    }
  case methodDidSave:
    if env.IsNotification() {
      p.publishPluginDiagnosticsForDocumentNotification(env)
    }
  case methodDidChange:
    if env.IsNotification() {
      if err := p.markDocumentDirty(env); err != nil {
        return false, err
      }
    }
  case methodDidClose:
    if env.IsNotification() {
      p.clearDocumentDiagnostics(env)
    }
  case methodExecuteCommand:
    if env.IsRequest() {
      return p.tryExecuteCommand(env)
    }
  case methodCodeAction:
    if env.IsRequest() {
      return p.handleCodeActionRequest(env)
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

func (p *Proxy) rememberInitializeRequest(env Envelope) {
  key := env.IDKey()
  if key == "" {
    return
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

// decodeCodeActionRequest extracts the request payload so the matching
// response from upstream can be augmented with ttsc-owned code actions
// for the same range.
func (p *Proxy) decodeCodeActionRequest(env Envelope) (pendingCodeActionRequest, bool) {
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
    Range   LSPRange             `json:"range"`
    Context LSPCodeActionContext `json:"context"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil {
    return pendingCodeActionRequest{}, false
  }
  return pendingCodeActionRequest{
    uri: params.TextDocument.URI,
    rng: params.Range,
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
  if p.ownsCommand("ttsc.format.document") {
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
    p.pendingMu.Unlock()
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
  generation := p.nextPluginDiagnosticsGeneration(params.URI)
  return func() {
    p.publishMergedPluginDiagnostics(params.URI, params.Version, true, generation)
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
  generation := p.nextPluginDiagnosticsGeneration(params.TextDocument.URI)
  go p.publishMergedPluginDiagnostics(params.TextDocument.URI, params.TextDocument.Version, false, generation)
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
  generation := p.nextPluginDiagnosticsGeneration(params.TextDocument.URI)
  go p.publishMergedPluginDiagnostics(params.TextDocument.URI, params.TextDocument.Version, false, generation)
  return nil
}

func (p *Proxy) publishMergedPluginDiagnostics(uri string, version *int, adoptCachedVersion bool, generation uint64) {
  if !p.isLatestPluginDiagnosticsGeneration(uri, generation) || p.isDocumentDirty(uri) {
    return
  }
  diagnostics := p.source.Diagnostics(LSPDocumentVersion{
    URI:     uri,
    Version: version,
  })
  version, merged, ok := p.prepareMergedPluginDiagnostics(uri, version, adoptCachedVersion, generation, diagnostics)
  if !ok {
    return
  }
  p.reportAsyncError(p.writePublishDiagnosticsIfCurrent(uri, version, merged, generation))
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
  return err == nil && string(disk) == text
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

func (p *Proxy) nextPluginDiagnosticsGeneration(uri string) uint64 {
  p.diagnosticsMu.Lock()
  defer p.diagnosticsMu.Unlock()
  next := p.diagnosticGeneration[uri] + 1
  p.diagnosticGeneration[uri] = next
  return next
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
  rawDiagnostics := make([]json.RawMessage, 0, len(diagnostics))
  for _, diagnostic := range diagnostics {
    raw, _ := json.Marshal(diagnostic)
    rawDiagnostics = append(rawDiagnostics, raw)
  }
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
  cachedDiagnostics := copyRawDiagnostics(cached.diagnostics)
  merged := make([]json.RawMessage, 0, len(cachedDiagnostics)+len(rawDiagnostics))
  merged = append(merged, cachedDiagnostics...)
  merged = append(merged, rawDiagnostics...)
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
