package lspserver

import (
  "bytes"
  "context"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "os/exec"
  "strings"
  "sync"
  "time"
)

const nativePluginCommandTimeout = 30 * time.Second
const nativePluginCommandStdoutLimit = 4 * 1024 * 1024
const nativePluginCommandStderrLimit = 1024 * 1024

// NativePluginManifest is the JSON shape the JavaScript ttscserver launcher
// passes through TTSC_LSP_PLUGINS_JSON after running normal project plugin
// discovery and source-plugin builds.
type NativePluginManifest struct {
  Plugins        []NativePluginConfigEntry `json:"plugins"`
  LSPPlugins     []NativeLSPPluginEntry    `json:"lspPlugins"`
  ProjectContext json.RawMessage           `json:"projectContext,omitempty"`
}

// NativePluginConfigEntry mirrors the compact sidecar protocol used by
// --plugins-json. It intentionally excludes host-only fields such as binary.
type NativePluginConfigEntry struct {
  Config map[string]any `json:"config"`
  Name   string         `json:"name"`
  Stage  string         `json:"stage"`
}

// NativeLSPPluginEntry names one built sidecar that opted into the LSP
// protocol through its JavaScript descriptor capabilities.
type NativeLSPPluginEntry struct {
  Binary             string `json:"binary"`
  Name               string `json:"name,omitempty"`
  ProjectInputs      bool   `json:"projectInputs,omitempty"`
  ProjectContextArgs bool   `json:"projectContextArgs,omitempty"`
  Stage              string `json:"stage,omitempty"`
}

// NativePluginSourceOptions configures a sidecar-backed PluginSource.
type NativePluginSourceOptions struct {
  Cwd          string
  Err          io.Writer
  ManifestJSON string
  Tsconfig     string
}

// NativePluginSource implements PluginSource by delegating to native sidecars
// that explicitly support ttsc's LSP subcommands.
type NativePluginSource struct {
  cwd                string
  err                io.Writer
  plugins            []NativeLSPPluginEntry
  pluginsJSON        string
  projectContextJSON string
  tsconfig           string

  commandIDs      []string
  codeActionKinds []string

  // completionHints is filled by a background fetch, so it needs a lock the
  // static verbs do not: the proxy reads it from the completion path while
  // discovery may still be writing it. It is the flattened publication-order
  // view of pluginHints, materialized on every store so the completion path
  // copies a ready slice instead of rebuilding one per keystroke.
  hintsMu         sync.RWMutex
  completionHints []LSPCompletionHint
  // pluginHints keeps each producer's corpus separately, keyed by plugin
  // identity, so one plugin's refresh cannot disturb another's. A producer's
  // entry changes only when that producer answers successfully: a refresh that
  // failed to run leaves the last known-good corpus in place rather than
  // blanking a working corpus over a transient spawn failure.
  pluginHints map[string]completionHintRecord
  // hintsObserver is told after every completed refresh cycle so the proxy can
  // react to a corpus that changed mid-session. Nil for any host that did not
  // register one.
  hintsObserver func()
  // hintsRefresh serializes and coalesces corpus refreshes. A refresh loads a
  // Program per plugin, so scheduling one per editor event without coalescing
  // would stack process spawns behind each other.
  hintsRefresh coalescingRefresh
  owners       map[string]NativeLSPPluginEntry
  logMu        sync.Mutex

  projectInputsMu       sync.RWMutex
  projectInputs         LSPProjectInputSnapshot
  pluginProjectInputs   map[string]projectInputRecord
  projectInputsObserver func()
  projectInputsRefresh  coalescingRefresh

  // residentMu guards the resident-daemon table below. A resident sidecar keeps
  // a warm Program across verbs, so lsp-diagnostics / lsp-code-actions reuse it
  // instead of respawning per verb; serveUnsupported remembers a sidecar that
  // predates lsp-serve so the source stops retrying it and stays on exec.
  residentMu       sync.Mutex
  residents        map[string]*residentSidecar
  serveUnsupported map[string]bool
}

type limitedBuffer struct {
  buf       bytes.Buffer
  limit     int
  truncated bool
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
  remaining := b.limit - b.Len()
  if remaining <= 0 {
    b.truncated = true
    return len(p), nil
  }
  if len(p) > remaining {
    _, _ = b.buf.Write(p[:remaining])
    b.truncated = true
    return len(p), nil
  }
  _, _ = b.buf.Write(p)
  return len(p), nil
}

func (b *limitedBuffer) Len() int {
  return b.buf.Len()
}

func (b *limitedBuffer) String() string {
  return b.buf.String()
}

func (b *limitedBuffer) Bytes() []byte {
  return b.buf.Bytes()
}

// NewNativePluginSource parses a launcher-produced manifest and discovers the
// command ids owned by every LSP-capable sidecar.
func NewNativePluginSource(opts NativePluginSourceOptions) (*NativePluginSource, error) {
  var manifest NativePluginManifest
  if strings.TrimSpace(opts.ManifestJSON) != "" {
    if err := json.Unmarshal([]byte(opts.ManifestJSON), &manifest); err != nil {
      return nil, fmt.Errorf("ttscserver: invalid TTSC_LSP_PLUGINS_JSON: %w", err)
    }
  }
  pluginsJSON, err := json.Marshal(manifest.Plugins)
  if err != nil {
    return nil, fmt.Errorf("ttscserver: encode plugin manifest: %w", err)
  }
  sidecarCwd := opts.Cwd
  sidecarTsconfig := opts.Tsconfig
  if len(manifest.ProjectContext) > 0 {
    var identity struct {
      PhysicalConfigPath  string `json:"physicalConfigPath"`
      PhysicalProjectRoot string `json:"physicalProjectRoot"`
    }
    if err := json.Unmarshal(manifest.ProjectContext, &identity); err != nil {
      return nil, fmt.Errorf("ttscserver: decode project context: %w", err)
    }
    if strings.TrimSpace(identity.PhysicalProjectRoot) != "" {
      sidecarCwd = identity.PhysicalProjectRoot
    }
    if strings.TrimSpace(identity.PhysicalConfigPath) != "" {
      sidecarTsconfig = identity.PhysicalConfigPath
    }
  }
  source := &NativePluginSource{
    cwd:                sidecarCwd,
    err:                opts.Err,
    plugins:            manifest.LSPPlugins,
    pluginsJSON:        string(pluginsJSON),
    projectContextJSON: string(manifest.ProjectContext),
    tsconfig:           sidecarTsconfig,
    owners:             map[string]NativeLSPPluginEntry{},
  }
  source.discoverCommandIDs()
  source.discoverProjectInputs(1)
  // The corpus fetch loads a Program, so it runs off the construction path.
  // Blocking here would delay initialize — and therefore the editor's first
  // response — for a feature most projects do not use. Until it lands,
  // CompletionHints answers nil and the editor sees exactly what it sees today.
  //
  // The first fetch goes through the same scheduler every later refresh uses,
  // so startup and mid-session rediscovery share one generation counter and one
  // coalescing rule rather than racing as two independent writers.
  source.RefreshCompletionHints()
  return source, nil
}

// Diagnostics asks every LSP-capable sidecar for document diagnostics and its
// separate project publication.
func (s *NativePluginSource) Diagnostics(doc LSPDocumentVersion) LSPDiagnosticsResult {
  if s == nil || doc.URI == "" {
    return LSPDiagnosticsResult{}
  }
  out := LSPDiagnosticsResult{}
  for _, plugin := range s.plugins {
    body, err := s.run(plugin, "lsp-diagnostics", "--uri="+doc.URI)
    if err != nil {
      s.log("%v", err)
      continue
    }
    result, err := decodeNativeDiagnostics(body)
    if err != nil {
      s.log("ttscserver: %s lsp-diagnostics returned invalid JSON: %v", pluginLabel(plugin), err)
      continue
    }
    out.Document = append(out.Document, result.Document...)
    if result.Project == nil {
      continue
    }
    if out.Project == nil {
      copied := *result.Project
      copied.Diagnostics = append([]LSPDiagnostic(nil), result.Project.Diagnostics...)
      out.Project = &copied
      continue
    }
    if out.Project.URI != result.Project.URI {
      s.log("ttscserver: %s returned project diagnostics for %s after %s; replacing the prior project publication", pluginLabel(plugin), result.Project.URI, out.Project.URI)
      copied := *result.Project
      copied.Diagnostics = append([]LSPDiagnostic(nil), result.Project.Diagnostics...)
      out.Project = &copied
      continue
    }
    out.Project.Diagnostics = append(out.Project.Diagnostics, result.Project.Diagnostics...)
  }
  return out
}

func decodeNativeDiagnostics(body []byte) (LSPDiagnosticsResult, error) {
  var result LSPDiagnosticsResult
  if err := json.Unmarshal(body, &result); err == nil {
    return result, nil
  }
  var legacy []LSPDiagnostic
  if err := json.Unmarshal(body, &legacy); err != nil {
    return LSPDiagnosticsResult{}, err
  }
  return LSPDiagnosticsResult{Document: legacy}, nil
}

// CodeActions asks every LSP-capable sidecar for actions matching the request.
func (s *NativePluginSource) CodeActions(uri string, rng LSPRange, ctx LSPCodeActionContext) []LSPCodeAction {
  if s == nil || uri == "" {
    return nil
  }
  rangeJSON, _ := json.Marshal(rng)
  contextJSON, _ := json.Marshal(ctx)
  var out []LSPCodeAction
  for _, plugin := range s.plugins {
    body, err := s.run(
      plugin,
      "lsp-code-actions",
      "--uri="+uri,
      "--range-json="+string(rangeJSON),
      "--context-json="+string(contextJSON),
    )
    if err != nil {
      s.log("%v", err)
      continue
    }
    var actions []LSPCodeAction
    if err := json.Unmarshal(body, &actions); err != nil {
      s.log("ttscserver: %s lsp-code-actions returned invalid JSON: %v", pluginLabel(plugin), err)
      continue
    }
    for _, action := range actions {
      if hasDirectCodeActionEdit(action.Edit) {
        s.log("ttscserver: %s returned direct LSP edit for action %q; command-backed actions are required", pluginLabel(plugin), action.Title)
        continue
      }
      if action.Command == nil {
        s.log("ttscserver: %s returned commandless LSP action %q; command-backed actions are required", pluginLabel(plugin), action.Title)
        continue
      }
      if !s.pluginOwnsCommand(plugin, action.Command.Command) {
        s.log("ttscserver: %s returned unowned LSP command %q", pluginLabel(plugin), action.Command.Command)
        continue
      }
      out = append(out, action)
    }
  }
  return out
}

// ExecuteCommand routes a ttsc-owned workspace command to the sidecar that
// advertised it through lsp-command-ids.
func (s *NativePluginSource) ExecuteCommand(command string, args []json.RawMessage) (*LSPWorkspaceEdit, error) {
  return s.ExecuteCommandWithContent(command, args, "", false)
}

// ExecuteCommandWithContent runs a ttsc-owned workspace command like
// ExecuteCommand, but when hasContent is true it asks the sidecar to format the
// supplied buffer text instead of the on-disk file. The buffer is passed by
// adding the --content-stdin flag and piping content to the sidecar's stdin, so
// the proxy can format dirty editor buffers (formatOnSave) without first writing
// them to disk. hasContent — not content != "" — gates the in-memory path: an
// empty buffer the user cleared is a valid document state and must still format
// in-memory (to a no-op) rather than falling through to stale disk content.
// Decoding of the returned WorkspaceEdit is identical to ExecuteCommand.
func (s *NativePluginSource) ExecuteCommandWithContent(command string, args []json.RawMessage, content string, hasContent bool) (*LSPWorkspaceEdit, error) {
  if s == nil {
    return nil, ErrCommandNotHandled
  }
  plugin, ok := s.owners[command]
  if !ok {
    return nil, ErrCommandNotHandled
  }
  argsJSON, _ := json.Marshal(args)
  cmdArgs := []string{
    "--command=" + command,
    "--arguments-json=" + string(argsJSON),
  }
  var stdin io.Reader
  if hasContent {
    cmdArgs = append(cmdArgs, "--content-stdin")
    stdin = strings.NewReader(content)
  }
  body, err := s.runWithStdin(plugin, "lsp-execute-command", stdin, cmdArgs...)
  if err != nil {
    return nil, err
  }
  if bytes.Equal(bytes.TrimSpace(body), []byte("null")) {
    return nil, nil
  }
  edit, err := decodeNativeLSPWorkspaceEdit(plugin, body)
  if err != nil {
    return nil, err
  }
  return edit, nil
}

func decodeNativeLSPWorkspaceEdit(plugin NativeLSPPluginEntry, body []byte) (*LSPWorkspaceEdit, error) {
  var probe struct {
    Changes         json.RawMessage `json:"changes,omitempty"`
    DocumentChanges json.RawMessage `json:"documentChanges,omitempty"`
  }
  if err := json.Unmarshal(body, &probe); err != nil {
    return nil, fmt.Errorf("ttscserver: %s lsp-execute-command returned invalid JSON: %w", pluginLabel(plugin), err)
  }
  if probe.DocumentChanges != nil && !bytes.Equal(bytes.TrimSpace(probe.DocumentChanges), []byte("null")) {
    return nil, fmt.Errorf("ttscserver: %s lsp-execute-command returned unsupported WorkspaceEdit.documentChanges; return changes or null", pluginLabel(plugin))
  }
  var edit LSPWorkspaceEdit
  if err := json.Unmarshal(body, &edit); err != nil {
    return nil, fmt.Errorf("ttscserver: %s lsp-execute-command returned invalid WorkspaceEdit: %w", pluginLabel(plugin), err)
  }
  return &edit, nil
}

// CommandIDs returns the command ids discovered at source construction time.
func (s *NativePluginSource) CommandIDs() []string {
  if s == nil || len(s.commandIDs) == 0 {
    return nil
  }
  out := make([]string, len(s.commandIDs))
  copy(out, s.commandIDs)
  return out
}

// CompletionHints returns the corpus plugins published, or nil until it has
// been fetched.
//
// Nil while loading is deliberate and is the whole reason the fetch is
// asynchronous. Unlike lsp-command-ids and lsp-code-action-kinds — which ignore
// their arguments and never build a Program — lsp-hints must load one, because
// a corpus is a projection of what a project rule's Check found. Paying that on
// the initialize path would delay every editor session for a feature most
// projects do not use, and paying it on the first completion would freeze the
// popup. Answering "no hints yet" degrades honestly: the editor still gets
// tsgo's completion, and ours appear once they exist.
//
// The same reasoning carries to refresh. It answers the last known-good corpus
// while a rediscovery scheduled by RefreshCompletionHints is running, so
// completion never blocks on a producer and never observes a half-cleared
// corpus.
func (s *NativePluginSource) CompletionHints() []LSPCompletionHint {
  if s == nil {
    return nil
  }
  s.hintsMu.RLock()
  defer s.hintsMu.RUnlock()
  if len(s.completionHints) == 0 {
    return nil
  }
  out := make([]LSPCompletionHint, len(s.completionHints))
  copy(out, s.completionHints)
  return out
}

// RefreshCompletionHints schedules one asynchronous corpus rediscovery.
//
// The corpus is a projection of what a project rule's Check found, so it goes
// stale the moment the rule's inputs change: a saved contributor-indexed
// document, a rule enabled in `lint.config.*`, a watched file rewritten outside
// the editor. Without this the corpus stayed a session snapshot and only a
// language-server restart could replace it.
//
// Asynchronous for the same reason the first fetch is (see CompletionHints):
// the editor event that schedules a refresh must not wait for a Program load.
// Concurrent requests coalesce into at most one queued rerun, so a save storm
// costs one extra refresh rather than one per notification, and the previous
// corpus keeps answering completion until the new one lands.
func (s *NativePluginSource) RefreshCompletionHints() {
  if s == nil || len(s.plugins) == 0 {
    return
  }
  s.hintsRefresh.schedule(s.discoverCompletionHints)
}

// SetCompletionHintsObserver registers fn to run after each completed refresh
// cycle. The proxy uses it to notice a trigger character that appeared after
// the initialize response was already sent. A nil fn clears the observer.
func (s *NativePluginSource) SetCompletionHintsObserver(fn func()) {
  if s == nil {
    return
  }
  s.hintsMu.Lock()
  defer s.hintsMu.Unlock()
  s.hintsObserver = fn
}

// completionHintRecord is one producer's corpus and the refresh generation that
// produced it. The generation is what keeps a slow refresh from overwriting a
// newer one: plugin fetches run sequentially inside a cycle, but two cycles can
// still be in flight when a scheduled refresh outlives its successor's start.
type completionHintRecord struct {
  hints      []LSPCompletionHint
  generation uint64
}

// discoverCompletionHints fetches every plugin's corpus for one generation.
//
// A separate pass from discoverCommandIDs rather than another step inside it.
// That loop abandons the rest of a plugin's discovery on any error, so folding
// hints in would mean a plugin whose corpus failed also lost its code action
// kinds — one optional feature taking down a working one.
//
// Each plugin's result is stored as it arrives instead of after the whole pass,
// so a fast producer's fresh corpus reaches the editor without waiting on a slow
// one, and a producer that failed keeps serving what it last published.
func (s *NativePluginSource) discoverCompletionHints(generation uint64) {
  for _, plugin := range s.plugins {
    body, err := s.run(plugin, "lsp-hints")
    if err != nil {
      // Silent, unlike every other discovery failure here. A plugin that does
      // not know this verb rejects it as an unknown command, and that is the
      // common case rather than the exceptional one: every plugin built before
      // this channel existed, forever. Logging it would print an error per
      // plugin per session for an optional feature nobody asked those plugins
      // for — the same reasoning that makes CompletionHints an optional
      // interface rather than a PluginSource method.
      //
      // The cost is that a plugin genuinely broken while producing hints also
      // goes quiet. That is the right trade: its hints are absent either way,
      // and the alternative is punishing every well-behaved old plugin to catch
      // a rare new one. Refresh strengthens that trade rather than weakening it:
      // a logged failure would now print per save instead of per session.
      continue
    }
    published, err := decodeNativeCompletionHints(body)
    if err != nil {
      // Not silent. A plugin that answered and answered wrongly implements the
      // verb and got it wrong, which is worth saying — unlike one that never
      // implemented it at all.
      s.log("ttscserver: %s lsp-hints returned invalid JSON: %v", pluginLabel(plugin), err)
      continue
    }
    s.storeCompletionHints(plugin, generation, published)
  }
  s.notifyCompletionHintsObserver()
}

// storeCompletionHints replaces one producer's corpus and rebuilds the flattened
// snapshot the completion path reads.
//
// A successful answer is the only thing that changes a producer's corpus, and an
// empty successful answer clears it — that is how a disabled rule's items stop
// being offered. An older generation is dropped: refresh cycles are scheduled by
// editor events, and the last event's answer is the one the user is waiting for.
func (s *NativePluginSource) storeCompletionHints(plugin NativeLSPPluginEntry, generation uint64, hints []LSPCompletionHint) {
  key := pluginKey(plugin)
  s.hintsMu.Lock()
  defer s.hintsMu.Unlock()
  if existing, ok := s.pluginHints[key]; ok && generation < existing.generation {
    return
  }
  if s.pluginHints == nil {
    s.pluginHints = map[string]completionHintRecord{}
  }
  s.pluginHints[key] = completionHintRecord{hints: hints, generation: generation}
  s.completionHints = s.flattenCompletionHintsLocked()
}

// flattenCompletionHintsLocked concatenates every producer's corpus in manifest
// order. Order is load-bearing twice over: the proxy resolves overlapping hints
// by publication order, and the editor ranks the items it is handed. Iterating
// the manifest rather than the map keeps that order identical across refreshes,
// which a Go map's randomized range would not. The caller holds hintsMu.
func (s *NativePluginSource) flattenCompletionHintsLocked() []LSPCompletionHint {
  hints := []LSPCompletionHint{}
  seen := make(map[string]struct{}, len(s.plugins))
  for _, plugin := range s.plugins {
    key := pluginKey(plugin)
    if _, duplicate := seen[key]; duplicate {
      continue
    }
    seen[key] = struct{}{}
    hints = append(hints, s.pluginHints[key].hints...)
  }
  return hints
}

// notifyCompletionHintsObserver runs the registered observer outside hintsMu:
// the observer reads the corpus back through CompletionHints, and holding the
// lock across it would deadlock on the RLock.
func (s *NativePluginSource) notifyCompletionHintsObserver() {
  s.hintsMu.RLock()
  observer := s.hintsObserver
  s.hintsMu.RUnlock()
  if observer != nil {
    observer()
  }
}

// pluginKey identifies one manifest entry. It matches the identity
// pluginOwnsCommand compares, so a manifest carrying the same binary under two
// stages keeps two independent corpora instead of overwriting one with the
// other.
func pluginKey(plugin NativeLSPPluginEntry) string {
  return plugin.Binary + "\x00" + plugin.Name + "\x00" + plugin.Stage
}

// decodeNativeCompletionHints accepts both generations of the lsp-hints wire.
//
// @ttsc/lint publishes one flat rule.Hint per item, with the scope and trigger
// nested under `trigger`. The first proxy implementation instead documented a
// grouped response with `scope`, `after`, and `items` at the top level. Flat
// entries are grouped here by trigger so the proxy keeps its efficient matching
// shape, while grouped responses remain valid for existing third-party
// sidecars. The first occurrence of a trigger fixes its group position and each
// later occurrence appends in publication order, preserving rule ranking.
func decodeNativeCompletionHints(body []byte) ([]LSPCompletionHint, error) {
  var entries []json.RawMessage
  if err := json.Unmarshal(body, &entries); err != nil {
    return nil, err
  }

  type triggerKey struct {
    scope string
    after string
  }
  flatGroups := map[triggerKey]int{}
  hints := make([]LSPCompletionHint, 0, len(entries))
  for _, entry := range entries {
    var fields map[string]json.RawMessage
    if err := json.Unmarshal(entry, &fields); err != nil {
      return nil, err
    }
    if _, grouped := fields["items"]; grouped {
      var hint LSPCompletionHint
      if err := json.Unmarshal(entry, &hint); err != nil {
        return nil, err
      }
      hint.Items = usableNativeCompletionItems(hint.Items)
      if hint.Scope == "" || hint.After == "" || len(hint.Items) == 0 {
        continue
      }
      hints = append(hints, hint)
      continue
    }

    var flat struct {
      LSPCompletionItem
      Trigger struct {
        Scope string `json:"scope"`
        After string `json:"after"`
      } `json:"trigger"`
    }
    if err := json.Unmarshal(entry, &flat); err != nil {
      return nil, err
    }
    if flat.Insert == "" || flat.Trigger.Scope == "" || flat.Trigger.After == "" {
      continue
    }
    key := triggerKey{scope: flat.Trigger.Scope, after: flat.Trigger.After}
    index, exists := flatGroups[key]
    if !exists {
      index = len(hints)
      flatGroups[key] = index
      hints = append(hints, LSPCompletionHint{
        Scope: flat.Trigger.Scope,
        After: flat.Trigger.After,
      })
    }
    hints[index].Items = append(hints[index].Items, flat.LSPCompletionItem)
  }
  return hints, nil
}

func usableNativeCompletionItems(items []LSPCompletionItem) []LSPCompletionItem {
  kept := make([]LSPCompletionItem, 0, len(items))
  for _, item := range items {
    if item.Insert != "" {
      kept = append(kept, item)
    }
  }
  return kept
}

// CodeActionKinds returns the action kinds discovered from LSP-capable sidecars.
func (s *NativePluginSource) CodeActionKinds() []string {
  if s == nil || len(s.codeActionKinds) == 0 {
    return nil
  }
  out := make([]string, len(s.codeActionKinds))
  copy(out, s.codeActionKinds)
  return out
}

func (s *NativePluginSource) discoverCommandIDs() {
  seen := map[string]struct{}{}
  kindSeen := map[string]struct{}{}
  for _, plugin := range s.plugins {
    body, err := s.run(plugin, "lsp-command-ids")
    if err != nil {
      s.log("%v", err)
      continue
    }
    var ids []string
    if err := json.Unmarshal(body, &ids); err != nil {
      s.log("ttscserver: %s lsp-command-ids returned invalid JSON: %v", pluginLabel(plugin), err)
      continue
    }
    for _, id := range ids {
      if id == "" {
        continue
      }
      if _, ok := seen[id]; ok {
        s.log("ttscserver: duplicate LSP command id %q from %s ignored", id, pluginLabel(plugin))
        continue
      }
      seen[id] = struct{}{}
      s.commandIDs = append(s.commandIDs, id)
      s.owners[id] = plugin
    }
    kindBody, kindErr := s.run(plugin, "lsp-code-action-kinds")
    if kindErr != nil {
      s.log("%v", kindErr)
      continue
    }
    var kinds []string
    if err := json.Unmarshal(kindBody, &kinds); err != nil {
      s.log("ttscserver: %s lsp-code-action-kinds returned invalid JSON: %v", pluginLabel(plugin), err)
      continue
    }
    for _, kind := range kinds {
      if kind == "" {
        continue
      }
      if _, ok := kindSeen[kind]; ok {
        continue
      }
      kindSeen[kind] = struct{}{}
      s.codeActionKinds = append(s.codeActionKinds, kind)
    }
  }
}

func (s *NativePluginSource) pluginOwnsCommand(plugin NativeLSPPluginEntry, command string) bool {
  if strings.TrimSpace(command) == "" {
    return false
  }
  owner, ok := s.owners[command]
  if !ok {
    return false
  }
  return owner.Binary == plugin.Binary && owner.Name == plugin.Name && owner.Stage == plugin.Stage
}

func (s *NativePluginSource) run(plugin NativeLSPPluginEntry, command string, args ...string) ([]byte, error) {
  // Route the Program-loading read verbs through the plugin's resident daemon so
  // a warm Program is reused across verbs. serveRun returns served=false for a
  // sidecar that predates lsp-serve or a transport failure, falling back to the
  // spawn-per-verb path below with no behavior change. The static discovery
  // verbs (lsp-command-ids / lsp-code-action-kinds) and lsp-execute-command stay
  // on exec by design.
  if command == serveVerbDiagnostics ||
    command == serveVerbProjectDiagnostics ||
    command == serveVerbCodeActions {
    if body, served, err := s.serveRun(plugin, command, args); served {
      return body, err
    }
  }
  if command == serveVerbHints {
    // Hints join the daemon on a weaker condition than the other two: the
    // answer is used only when it arrives without error. A sidecar built after
    // the daemon landed but before this verb joined it answers lsp-serve and
    // rejects lsp-hints as an unknown verb, which reaches this side as a
    // nonzero code — indistinguishable over this protocol from a rule that
    // failed. Falling back to the spawn path on any nonzero reply keeps that
    // sidecar's corpus working, and a project whose hints genuinely fail pays
    // one extra spawn to fail there too, exactly as it did before.
    if body, served, err := s.serveRun(plugin, command, args); served && err == nil {
      return body, nil
    }
  }
  return s.runWithStdin(plugin, command, nil, args...)
}

// runWithStdin runs a sidecar subcommand like run, additionally wiring stdin to
// the supplied reader when it is non-nil. Callers that do not pass buffer text
// (Diagnostics, CodeActions, discovery) reach this through run with a nil
// reader, leaving the sidecar's stdin unset exactly as before.
func (s *NativePluginSource) runWithStdin(plugin NativeLSPPluginEntry, command string, stdin io.Reader, args ...string) ([]byte, error) {
  if strings.TrimSpace(plugin.Binary) == "" {
    return nil, fmt.Errorf("ttscserver: %s has no binary", pluginLabel(plugin))
  }
  ctx, cancel := context.WithTimeout(context.Background(), nativePluginCommandTimeout)
  defer cancel()
  allArgs := []string{
    command,
    "--cwd=" + s.cwd,
    "--tsconfig=" + s.tsconfig,
    "--plugins-json=" + s.pluginsJSON,
  }
  if plugin.ProjectContextArgs && strings.TrimSpace(s.projectContextJSON) != "" {
    allArgs = append(allArgs, "--project-context-json="+s.projectContextJSON)
  }
  allArgs = append(allArgs, args...)
  cmd := exec.CommandContext(ctx, plugin.Binary, allArgs...)
  cmd.Dir = s.cwd
  cmd.Env = os.Environ()
  if stdin != nil {
    cmd.Stdin = stdin
  }
  stdout := limitedBuffer{limit: nativePluginCommandStdoutLimit}
  stderr := limitedBuffer{limit: nativePluginCommandStderrLimit}
  cmd.Stdout = &stdout
  cmd.Stderr = &stderr
  err := cmd.Run()
  if ctx.Err() != nil {
    return nil, fmt.Errorf("ttscserver: %s %s timed out", pluginLabel(plugin), command)
  }
  if err != nil {
    msg := strings.TrimSpace(stderr.String())
    if msg == "" {
      msg = err.Error()
    } else if stderr.truncated || stderr.Len() >= nativePluginCommandStderrLimit {
      msg += " (stderr truncated)"
    }
    return nil, fmt.Errorf("ttscserver: %s %s failed: %s", pluginLabel(plugin), command, msg)
  }
  if stdout.truncated {
    return nil, fmt.Errorf("ttscserver: %s %s produced more than %d bytes on stdout", pluginLabel(plugin), command, nativePluginCommandStdoutLimit)
  }
  return bytes.TrimSpace(stdout.Bytes()), nil
}

func hasDirectCodeActionEdit(edit json.RawMessage) bool {
  trimmed := bytes.TrimSpace(edit)
  return len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null"))
}

func (s *NativePluginSource) log(format string, args ...any) {
  if s == nil || s.err == nil {
    return
  }
  s.logMu.Lock()
  defer s.logMu.Unlock()
  fmt.Fprintf(s.err, format+"\n", args...)
}

func pluginLabel(plugin NativeLSPPluginEntry) string {
  if plugin.Name != "" {
    return plugin.Name
  }
  if plugin.Binary != "" {
    return plugin.Binary
  }
  return "plugin"
}
