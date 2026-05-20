package lspserver

import (
  "bytes"
  "context"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "sync"
)

// ErrCommandNotHandled is returned by PluginSource.ExecuteCommand for
// commands ttsc does not own. Callers should fall through to upstream.
var ErrCommandNotHandled = errors.New("lsp: command not handled by ttsc")

const (
  methodPublishDiagnostics = "textDocument/publishDiagnostics"
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
}

// Proxy bridges the editor and an upstream tsgo LSP process, intercepting
// the message types ttsc cares about (publishDiagnostics merge, code
// action augmentation, executeCommand for ttsc-owned commands).
type Proxy struct {
  editorIn    io.Reader
  editorOut   io.Writer
  upstreamIn  io.Writer
  upstreamOut io.Reader
  source      PluginSource

  writeMu sync.Mutex // serializes WriteFrame calls to editorOut

  pendingMu      sync.Mutex
  pendingActions map[string]pendingCodeActionRequest
}

type pendingCodeActionRequest struct {
  uri string
  rng LSPRange
  ctx LSPCodeActionContext
}

// NewProxy returns a Proxy ready to Run. The PluginSource is required;
// pass NullPluginSource{} for a no-contribution setup.
func NewProxy(opts ProxyOptions) *Proxy {
  source := opts.Source
  if source == nil {
    source = NullPluginSource{}
  }
  return &Proxy{
    editorIn:       opts.EditorIn,
    editorOut:      opts.EditorOut,
    upstreamIn:     opts.UpstreamIn,
    upstreamOut:    opts.UpstreamOut,
    source:         source,
    pendingActions: make(map[string]pendingCodeActionRequest),
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
  for i := 0; i < 2; i++ {
    err := <-errCh
    if first == nil && err != nil && !errors.Is(err, ErrFrameClosed) {
      first = err
    }
  }
  return first
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
      if forwardErr := WriteFrame(p.upstreamIn, body); forwardErr != nil {
        return forwardErr
      }
      continue
    }
    handled, handleErr := p.handleEditorEnvelope(env)
    if handleErr != nil {
      return handleErr
    }
    if handled {
      continue
    }
    if err := WriteFrame(p.upstreamIn, body); err != nil {
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
func (p *Proxy) handleEditorEnvelope(env Envelope) (bool, error) {
  switch env.Method {
  case methodExecuteCommand:
    if env.IsRequest() {
      return p.tryExecuteCommand(env)
    }
  case methodCodeAction:
    if env.IsRequest() {
      p.rememberCodeActionRequest(env)
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
  delete(p.pendingActions, key)
}

// rememberCodeActionRequest stores the request payload so the matching
// response from upstream can be augmented with ttsc-owned code actions
// for the same range.
func (p *Proxy) rememberCodeActionRequest(env Envelope) {
  var params struct {
    TextDocument struct {
      URI string `json:"uri"`
    } `json:"textDocument"`
    Range   LSPRange             `json:"range"`
    Context LSPCodeActionContext `json:"context"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil {
    return
  }
  p.pendingMu.Lock()
  defer p.pendingMu.Unlock()
  p.pendingActions[env.IDKey()] = pendingCodeActionRequest{
    uri: params.TextDocument.URI,
    rng: params.Range,
    ctx: params.Context,
  }
}

// tryExecuteCommand handles workspace/executeCommand requests whose
// command id is registered with the PluginSource. Returns true on a
// successful local response; false when the command should fall through
// to upstream tsgo.
func (p *Proxy) tryExecuteCommand(env Envelope) (bool, error) {
  var params struct {
    Command   string            `json:"command"`
    Arguments []json.RawMessage `json:"arguments,omitempty"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil {
    return false, nil
  }
  if !p.ownsCommand(params.Command) {
    return false, nil
  }
  edit, err := p.source.ExecuteCommand(params.Command, params.Arguments)
  if errors.Is(err, ErrCommandNotHandled) {
    return false, nil
  }
  if err != nil {
    return true, p.writeError(env.ID, fmt.Sprintf("ttsc command %q failed: %v", params.Command, err))
  }
  // Cycle 1 returns the WorkspaceEdit inside the executeCommand response
  // instead of sending workspace/applyEdit as a server→client request.
  // ttsc owns both ends (its VSCode extension), so the extension applies
  // the edit on its side. Sticking to one direction avoids tracking our
  // own outgoing request ids in the proxy.
  if edit == nil {
    return true, p.writeResult(env.ID, nil)
  }
  return true, p.writeResult(env.ID, edit)
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
    augmented := p.augmentUpstream(env, body)
    if err := p.writeEditorFrame(augmented); err != nil {
      return err
    }
  }
}

// augmentUpstream returns the (possibly rewritten) body to forward. For
// publishDiagnostics it merges ttsc plugin diagnostics; for codeAction
// responses tied to a remembered request it appends ttsc actions.
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
  if env.IsNotification() && env.Method == methodPublishDiagnostics {
    if merged, ok := p.mergePublishDiagnostics(env); ok {
      return merged
    }
  }
  if env.IsResponse() {
    p.pendingMu.Lock()
    pending, ok := p.pendingActions[env.IDKey()]
    if ok {
      delete(p.pendingActions, env.IDKey())
    }
    p.pendingMu.Unlock()
    if ok {
      if augmented, augOk := p.appendCodeActions(env, pending); augOk {
        return augmented
      }
    }
  }
  return body
}

// mergePublishDiagnostics decodes the publishDiagnostics params, asks
// the PluginSource for the URI's contributions, appends them, and
// re-encodes the envelope. Returns the rewritten body and true on
// success; ok=false means "nothing to merge — forward the upstream body
// verbatim." Re-encoding our own types is guaranteed by their
// definitions in lsp_plugin.go, so the marshal errors are not checked.
func (p *Proxy) mergePublishDiagnostics(env Envelope) ([]byte, bool) {
  var params struct {
    URI         string            `json:"uri"`
    Version     *int              `json:"version,omitempty"`
    Diagnostics []json.RawMessage `json:"diagnostics"`
  }
  if err := json.Unmarshal(env.Params, &params); err != nil {
    return nil, false
  }
  extras := p.source.Diagnostics(LSPDocumentVersion{URI: params.URI, Version: params.Version})
  if len(extras) == 0 {
    return nil, false
  }
  for _, extra := range extras {
    raw, _ := json.Marshal(extra)
    params.Diagnostics = append(params.Diagnostics, raw)
  }
  env.Params, _ = json.Marshal(params)
  body, _ := json.Marshal(env)
  return body, true
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
  trimmed := bytes.TrimSpace(env.Result)
  if len(trimmed) > 0 && trimmed[0] != '[' && !bytes.Equal(trimmed, []byte("null")) {
    return nil, false
  }
  actions := p.source.CodeActions(pending.uri, pending.rng, pending.ctx)
  if len(actions) == 0 {
    return nil, false
  }
  var existing []json.RawMessage
  if len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null")) {
    _ = json.Unmarshal(trimmed, &existing)
  }
  for _, action := range actions {
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

// writeResult sends a JSON-RPC success response with the given result to
// the editor. A nil result is marshalled as JSON null.
func (p *Proxy) writeResult(id json.RawMessage, result any) error {
  rawResult, _ := json.Marshal(result)
  env := Envelope{JSONRPC: "2.0", ID: id, Result: rawResult}
  body, _ := json.Marshal(env)
  return p.writeEditorFrame(body)
}

// jsonRPCInternalError is the JSON-RPC 2.0 reserved error code for
// "Internal error" (spec §5.1).
const jsonRPCInternalError = -32603

// writeError sends a JSON-RPC error response to the editor. message is
// embedded verbatim in the error object; callers are responsible for
// keeping it concise and safe to surface in editor UI.
func (p *Proxy) writeError(id json.RawMessage, message string) error {
  errPayload, _ := json.Marshal(struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
  }{Code: jsonRPCInternalError, Message: message})
  env := Envelope{JSONRPC: "2.0", ID: id, Error: errPayload}
  body, _ := json.Marshal(env)
  return p.writeEditorFrame(body)
}
