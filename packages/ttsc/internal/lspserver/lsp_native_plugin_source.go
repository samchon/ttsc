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
  "sync/atomic"
  "time"
)

const nativePluginCommandStdoutLimit = 4 * 1024 * 1024
const nativePluginCommandStderrLimit = 1024 * 1024

// NativePluginManifest is the JSON shape the JavaScript ttscserver launcher
// writes to its private manifest file after running normal project plugin
// discovery and source-plugin builds.
//
// @evidence contracts/common.md#principled-implementation Descriptor entries, executable entries and initial input snapshots remain distinct; raw project context preserves the launcher-selected identity.
// @evidence contracts/common.md#clear-and-simple-design One manifest captures immutable startup inputs without mixing later refresh state into its wire shape.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Initial snapshot keys refer to actual launcher data rather than embedded expected project selections.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the launcher producer and selection-change effect, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Binary locations and project context carry native paths separately from diagnostic URIs; the source performs native interpretation.
// @evidenceExclude contracts/performance.md#efficient-algorithms The manifest carries startup values; construction selects discovery and validation algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The value does not coordinate producer reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resource acquisition belongs to the constructed source rather than this transport value.
type NativePluginManifest struct {
  InitialProjectInputs map[string]LSPProjectInputSnapshot `json:"initialProjectInputs,omitempty"`
  Plugins              []NativePluginConfigEntry          `json:"plugins"`
  LSPPlugins           []NativeLSPPluginEntry             `json:"lspPlugins"`
  ProjectContext       json.RawMessage                    `json:"projectContext,omitempty"`

  // SelectionInputs are what the plugin selection itself was loaded from. A
  // change to one ends the session like a plugin's own reload input.
  SelectionInputs *NativePluginSelectionInputs `json:"selectionInputs,omitempty"`
}

// NativePluginConfigEntry mirrors the compact sidecar protocol used by
// --plugins-json. It intentionally excludes host-only fields such as binary.
//
// @evidence contracts/common.md#principled-implementation Name, stage and JSON configuration preserve the compact descriptor protocol independently of executable metadata.
// @evidence contracts/common.md#clear-and-simple-design Sidecar configuration excludes host-only binary fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Configuration comes from project discovery rather than known rule fixtures.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why binary metadata is absent, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation These JSON descriptor values define no filesystem or process boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms The value chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work It does not coordinate configuration reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It carries data without a native resource lifecycle.
type NativePluginConfigEntry struct {
  Config map[string]any `json:"config"`
  Name   string         `json:"name"`
  Stage  string         `json:"stage"`
}

// NativeLSPPluginEntry names one built sidecar that opted into the LSP
// protocol through its JavaScript descriptor capabilities.
//
// @evidence contracts/common.md#principled-implementation Binary identity, initial snapshots and capability flags distinguish supported native operations without assuming every descriptor supports every verb.
// @evidence contracts/common.md#clear-and-simple-design Executable capabilities remain separate from generic plugin configuration.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Capability flags come from the descriptor contract rather than probing known package names.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the opt-in boundary, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Binary is a native executable path passed as exec's executable argument, not a shell command; project context is separately capability-gated.
// @evidenceExclude contracts/performance.md#efficient-algorithms Source operations own transport selection and processing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The entry describes identity inputs without coordinating execution reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The source owns processes started from this descriptor.
type NativeLSPPluginEntry struct {
  Binary                 string                   `json:"binary"`
  InitialProjectInputKey string                   `json:"initialProjectInputKey,omitempty"`
  InitialProjectInputs   *LSPProjectInputSnapshot `json:"initialProjectInputs,omitempty"`
  Name                   string                   `json:"name,omitempty"`
  ProjectDiagnostics     bool                     `json:"projectDiagnostics,omitempty"`
  ProjectInputs          bool                     `json:"projectInputs,omitempty"`
  ProjectContextArgs     bool                     `json:"projectContextArgs,omitempty"`
  Stage                  string                   `json:"stage,omitempty"`
}

// NativePluginSourceOptions configures a sidecar-backed PluginSource.
//
// ManifestJSON is the launcher manifest, Cwd and Tsconfig name the client's
// selected project, and Err receives source diagnostics without owning closure.
//
// @evidence contracts/common.md#principled-implementation Client identity and manifest data permit the source to distinguish logical publication from physical sidecar execution context.
// @evidence contracts/common.md#clear-and-simple-design Construction captures all dependencies in one invocation value.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A caller-supplied log sink avoids global stderr mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies project inputs and log closure ownership, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Cwd and Tsconfig are native project locations; manifest parsing handles separate physical context rather than inferring identity from OS names.
// @evidenceExclude contracts/performance.md#efficient-algorithms Options select no processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Construction owns producer coordination.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The constructed source acquires resources; these options do not.
type NativePluginSourceOptions struct {
  Cwd          string
  Err          io.Writer
  ManifestJSON string
  Tsconfig     string
}

// NativePluginSource implements PluginSource by delegating to native sidecars
// that explicitly support ttsc's LSP subcommands.
//
// Close terminates native children and rejects later process starts. Refresh
// failures preserve last-good producer publications until a successful update.
//
// @evidence contracts/common.md#principled-implementation Per-producer records distinguish last-good state from current generations; transport identity includes the executable and negotiated project-context arguments.
// @evidence contracts/common.md#clear-and-simple-design Independent locks protect corpus, input, diagnostic and resident state; shared transport helpers own command execution.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Older serve support has an explicit direct-command fallback; owner selection uses descriptor capabilities rather than package-specific patches.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain lifecycle, retained publications and lock responsibilities with separated members under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation exec receives executable and argument vectors; Windows helpers query owning-directory flags separately from file URIs. An unknown flag preserves identity distinctions and broadens glob invalidation matching instead of authorizing a false merge or losing an event.
// @evidenceExclude contracts/performance.md#efficient-algorithms Source operations choose algorithms; this type groups their protected state.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The type represents cache identity and generations; operation acknowledgments justify sharing and invalidation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Close and refresh/serve operations control acquisitions and release; the representation itself does not execute them.
type NativePluginSource struct {
  cwd                string
  err                io.Writer
  plugins            []NativeLSPPluginEntry
  pluginsJSON        string
  projectContextJSON string
  tsconfig           string
  clientTsconfig     string
  clientCwd          string

  // The client's project resolves once. Both halves are fixed for the
  // session, while the answer costs a symlink walk per ancestor, and the
  // question is asked again for every producer on every publication.
  clientProjectOnce sync.Once

  clientProject    string
  clientProjectKey string

  commandIDs      []string
  codeActionKinds []string

  // completionHints is filled by a background fetch, so it needs a lock the
  // static verbs do not: the proxy reads it from the completion path while
  // discovery may still be writing it. It is the flattened publication-order
  // view of pluginHints, materialized on every store so the completion path
  // copies a ready slice instead of rebuilding one per keystroke.
  hintsMu sync.RWMutex

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

  owners map[string]NativeLSPPluginEntry
  logMu  sync.Mutex

  projectInputsMu sync.RWMutex
  projectInputs   LSPProjectInputSnapshot

  // selection is fixed for the session: its directories are watched in every
  // flattened snapshot, whatever the plugins later rediscover, and checked
  // beside its reload inputs.
  selection pluginSelectionInputs

  pluginProjectInputs   map[string]projectInputRecord
  projectInputsObserver func()
  projectInputsRefresh  coalescingRefresh

  projectDiagnosticsMu       sync.RWMutex
  pluginProjectDiagnostics   map[string]projectDiagnosticRecord
  projectDiagnosticsSequence atomic.Uint64

  // residentMu guards the resident-daemon table below. A resident sidecar keeps
  // a warm Program across verbs, so lsp-diagnostics / lsp-code-actions reuse it
  // instead of respawning per verb; serveUnsupported remembers a sidecar that
  // predates lsp-serve so the source stops retrying it and stays on exec.
  residentMu sync.Mutex

  residents        map[string]*residentSidecar
  serveUnsupported map[string]bool

  processContext  context.Context
  cancelProcesses context.CancelFunc
  closed          bool
}

type limitedBuffer struct {
  buf       bytes.Buffer
  limit     int
  truncated bool
}

// commandContext resolves the source lifetime even for a zero-value source.
// residentMu also orders lazy initialization against Close.
func (s *NativePluginSource) commandContext() context.Context {
  s.residentMu.Lock()
  defer s.residentMu.Unlock()
  if s.processContext == nil {
    s.processContext, s.cancelProcesses = context.WithCancel(context.Background())
    if s.closed {
      s.cancelProcesses()
    }
  }
  return s.processContext
}

// Close ends this source's session and terminates its native children. Calls
// after Close cannot start another child. A running rule has no computation
// deadline while the source remains open.
//
// @evidence contracts/common.md#principled-implementation Marking the source closed and cancelling its shared context precede waiting for resident locks, so blocked reply reads can finish before teardown joins their processes.
// @evidence contracts/common.md#clear-and-simple-design One idempotent source boundary terminates both one-shot and resident children and closes refresh scheduling.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Cancellation corrects process ownership rather than adding a timeout to conceal a blocked shutdown.
// @evidence contracts/common.md#meaningful-documentation Native prose states post-close behavior and the absence of a computation deadline, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation CommandContext cancellation and pipe closure use Go abstractions across native platforms; inherited descendant processes are not themselves owned or recursively terminated.
// @evidenceExclude contracts/performance.md#efficient-algorithms Teardown owns lifecycle rather than a computation processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Closing source ownership is not reusable computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources Shared cancellation stops native children before resident Wait; closed schedulers reject new work and discard queued reruns. Already running callbacks and caller-owned writers have no independent join or timeout here.
func (s *NativePluginSource) Close() error {
  s.shutdownResidents()
  return nil
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
//
// @evidence contracts/common.md#principled-implementation Parsed manifest snapshots are normalized and fingerprint-checked before acceptance; the source retains logical client identity while honoring physical sidecar context.
// @evidence contracts/common.md#clear-and-simple-design Static command discovery precedes snapshot initialization; optional corpus work starts through the ordinary refresh scheduler.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing initial snapshots trigger supported discovery rather than guessed selection; malformed startup identity is rejected.
// @evidence contracts/common.md#meaningful-documentation Native prose states manifest parsing and command discovery; lifecycle comments explain asynchronous corpus startup under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Native process arguments and snapshot paths use host path APIs; protocol URIs retain the client-selected spelling separately.
// @evidence contracts/performance.md#efficient-algorithms Startup traverses descriptor entries and their input snapshots; transport selection deduplicates equivalent binaries before expensive command discovery.
// @evidence contracts/performance.md#reuse-equivalent-work Command owners and capabilities are discovered once for immutable session descriptors; initial shared snapshot keys avoid rediscovering a launcher-proven graph.
// @evidence contracts/performance.md#bound-retention-and-release-resources A construction failure closes the partially initialized source; success transfers lifetime to the caller's Close or Proxy.Run teardown. Corpus and diagnostic bytes grow with producer output under per-command caps, without a separate aggregate byte budget.
func NewNativePluginSource(opts NativePluginSourceOptions) (*NativePluginSource, error) {
  var manifest NativePluginManifest
  if strings.TrimSpace(opts.ManifestJSON) != "" {
    if err := json.Unmarshal([]byte(opts.ManifestJSON), &manifest); err != nil {
      // The manifest reaches this constructor through three transports, so it
      // is named by what it is rather than by the one that happened to carry it.
      return nil, fmt.Errorf("ttscserver: invalid LSP plugin manifest: %w", err)
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
    clientTsconfig:     opts.Tsconfig,
    clientCwd:          opts.Cwd,
    owners:             map[string]NativeLSPPluginEntry{},
  }
  accepted := false
  defer func() {
    if !accepted {
      source.shutdownResidents()
    }
  }()
  source.discoverCommandIDs()
  missingInitialProjectInputs := false
  for _, plugin := range selectPluginTransports(
    source.plugins,
    func(plugin NativeLSPPluginEntry) bool {
      return plugin.ProjectInputs
    },
    source.projectContextJSON,
  ) {
    initialProjectInputs := plugin.InitialProjectInputs
    if plugin.InitialProjectInputKey != "" {
      snapshot, ok := manifest.InitialProjectInputs[plugin.InitialProjectInputKey]
      if !ok {
        return nil, fmt.Errorf(
          "ttscserver: %s initial project inputs key %q is missing from the manifest",
          pluginLabel(plugin),
          plugin.InitialProjectInputKey,
        )
      }
      initialProjectInputs = &snapshot
    }
    if initialProjectInputs == nil {
      missingInitialProjectInputs = true
      continue
    }
    snapshot, err := normalizeLSPProjectInputSnapshot(
      *initialProjectInputs,
      source.cwd,
    )
    if err != nil {
      return nil, fmt.Errorf(
        "ttscserver: %s initial project inputs are invalid: %w",
        pluginLabel(plugin),
        err,
      )
    }
    if !projectInputReloadFingerprintsAreCurrent(snapshot) {
      return nil, fmt.Errorf(
        "ttscserver: %s project selection inputs changed during startup",
        pluginLabel(plugin),
      )
    }
    source.storeProjectInputs(plugin, 1, snapshot)
  }
  if missingInitialProjectInputs {
    source.discoverProjectInputs(1)
  }
  if manifest.SelectionInputs != nil {
    selection, err := newPluginSelectionInputs(*manifest.SelectionInputs)
    if err != nil {
      return nil, fmt.Errorf(
        "ttscserver: plugin selection inputs are invalid: %w",
        err,
      )
    }
    if !selection.current() {
      return nil, fmt.Errorf(
        "ttscserver: plugin selection inputs changed during startup",
      )
    }
    source.projectInputsMu.Lock()
    source.selection = selection
    source.projectInputs = source.flattenProjectInputsLocked()
    source.projectInputsMu.Unlock()
  }
  // The corpus fetch loads a Program, so it runs off the construction path.
  // Blocking here would delay initialize — and therefore the editor's first
  // response — for a feature most projects do not use. Until it lands,
  // CompletionHints answers nil and the editor sees exactly what it sees today.
  //
  // The first fetch goes through the same scheduler every later refresh uses,
  // so startup and mid-session rediscovery share one generation counter and one
  // coalescing rule rather than racing as two independent writers.
  source.RefreshCompletionHints()
  accepted = true
  return source, nil
}

// Diagnostics asks every LSP-capable sidecar for document diagnostics and its
// separate project publication.
//
// @evidence contracts/common.md#principled-implementation Legacy document arrays and structured document/project results are decoded separately; successful producer generations update only their own project publication.
// @evidence contracts/common.md#clear-and-simple-design Transport deduplication and result decoding are shared helpers; document and project outputs remain distinct.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy wire decoding is a supported protocol difference, while failed producers retain explicitly last-good project state rather than claiming fresh output.
// @evidence contracts/common.md#meaningful-documentation Native prose states document and project contribution scope, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Sidecars receive native executable/argv vectors and logical document URIs separately; project publication maps physical producer identity back to the client's logical config URI.
// @evidence contracts/performance.md#efficient-algorithms Each distinct transport runs once; decoding and result appending scale with returned bytes and diagnostics. Project aggregation follows descriptor order.
// @evidence contracts/performance.md#reuse-equivalent-work Resident daemons reuse compiler state across supported read verbs; save and watched-input invalidation distinguish incremental changes from topology reloads. Document results are not cached solely by URI.
// @evidence contracts/performance.md#bound-retention-and-release-resources Command output is capped, residents live until source Close, and one last-good project record is retained per producer. Concurrent document callers are not subject to an outstanding-request count cap.
func (s *NativePluginSource) Diagnostics(doc LSPDocumentVersion) LSPDiagnosticsResult {
  if s == nil || doc.URI == "" {
    return LSPDiagnosticsResult{}
  }
  generation := s.projectDiagnosticsSequence.Add(1)
  out := LSPDiagnosticsResult{
    projectUpdatedProducers: map[string]struct{}{},
  }
  for _, plugin := range selectPluginTransports(
    s.plugins,
    nil,
    s.projectContextJSON,
  ) {
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
    if result.Project != nil && result.Project.URI != "" {
      s.storeProjectDiagnostics(plugin, generation, result.Project)
      out.projectUpdatedProducers[pluginKey(plugin, s.projectContextJSON)] = struct{}{}
    }
  }
  if len(out.projectUpdatedProducers) != 0 {
    out.Project = s.projectDiagnosticsSnapshot()
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
//
// @evidence contracts/common.md#principled-implementation Range/context are serialized unchanged; direct edits and unowned commands are rejected because native actions execute through advertised ownership.
// @evidence contracts/common.md#clear-and-simple-design Producer queries and ownership validation share the existing transport and command map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Edit rejection is a native ownership boundary, not a success-shaped substitute for implementing an advertised command.
// @evidence contracts/common.md#meaningful-documentation Native prose states matching inputs; nearby validation comments explain command-only ownership under the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation URI remains protocol data while native exec receives separate argv entries; no shell quoting or OS-name-based path folding occurs.
// @evidence contracts/performance.md#efficient-algorithms Transport deduplication precedes queries; action validation is linear in returned action count with constant-time command owner lookup.
// @evidence contracts/performance.md#reuse-equivalent-work Resident read verbs share valid compiler state; actions remain specific to URI, range and context instead of sharing by returned shape.
// @evidence contracts/performance.md#bound-retention-and-release-resources Returned actions transfer to the caller; resident processes terminate on Close and response bytes are capped. There is no independent cap on concurrently waiting callers.
func (s *NativePluginSource) CodeActions(uri string, rng LSPRange, ctx LSPCodeActionContext) []LSPCodeAction {
  if s == nil || uri == "" {
    return nil
  }
  rangeJSON, _ := json.Marshal(rng)
  contextJSON, _ := json.Marshal(ctx)
  var out []LSPCodeAction
  for _, plugin := range selectPluginTransports(
    s.plugins,
    nil,
    s.projectContextJSON,
  ) {
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
//
// @evidence contracts/common.md#principled-implementation Delegation retains command ownership and argument meaning while explicitly selecting the disk-backed path.
// @evidence contracts/common.md#clear-and-simple-design The content-aware operation owns execution and edit decoding for both entries.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This forwarding entry does not maintain a separate command interpretation.
// @evidence contracts/common.md#meaningful-documentation Native prose names the advertised owner boundary, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The delegated operation owns executable argv and native working-directory interpretation.
// @evidenceExclude contracts/performance.md#efficient-algorithms ExecuteCommandWithContent owns command processing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The delegated operation owns the effectful command policy.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Native child ownership belongs to the delegated executor and source lifetime.
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
//
// @evidence contracts/common.md#principled-implementation Advertised ownership selects the producer; hasContent distinguishes an empty live buffer from absent buffer input. Invalid raw argument JSON is rejected before a process starts.
// @evidence contracts/common.md#clear-and-simple-design One executor handles disk and stdin modes, then decodes the supported WorkspaceEdit shape.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Empty content does not trigger a stale-disk fallback; unknown commands return the ownership sentinel.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain empty-buffer semantics and shared decoding, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation exec receives binary and separate flags; live buffer text travels through stdin without shell interpolation or newline rewriting.
// @evidence contracts/performance.md#efficient-algorithms Argument encoding and edit decoding scale with payload bytes; strings.Reader supplies existing content without creating a concatenated command string.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Executing a workspace command may cause external effects, so matching inputs do not authorize shared execution.
// @evidence contracts/performance.md#bound-retention-and-release-resources Each child is waited and tied to source cancellation; stdout/stderr caps bound retained output and WaitDelay limits inherited-pipe draining after exit. Concurrent command count is not capped.
func (s *NativePluginSource) ExecuteCommandWithContent(command string, args []json.RawMessage, content string, hasContent bool) (*LSPWorkspaceEdit, error) {
  if s == nil {
    return nil, ErrCommandNotHandled
  }
  plugin, ok := s.owners[command]
  if !ok {
    return nil, ErrCommandNotHandled
  }
  argsJSON, encodeErr := json.Marshal(args)
  if encodeErr != nil {
    return nil, fmt.Errorf("ttscserver: encode command arguments: %w", encodeErr)
  }
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
//
// @evidence contracts/common.md#principled-implementation Copying the immutable discovered IDs prevents callers from rewriting source command ownership.
// @evidence contracts/common.md#clear-and-simple-design Discovery owns identity selection; this accessor only exposes its result.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Identities come from actual producer advertisement rather than a fixed command list.
// @evidence contracts/common.md#meaningful-documentation Native prose states construction-time discovery, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This accessor copies protocol strings without interpreting native paths or processes.
// @evidence contracts/performance.md#efficient-algorithms Copying N IDs takes O(N) time and output space without rediscovery.
// @evidence contracts/performance.md#reuse-equivalent-work Immutable session descriptors authorize sharing the construction-time command list among all callers.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned copy transfers to the caller; source lifetime owns the original list.
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
//
// @evidence contracts/common.md#principled-implementation Locked publication reads return independent hint and item slices, preventing consumers from mutating producer state; failed refreshes retain last-good state explicitly.
// @evidence contracts/common.md#clear-and-simple-design Writers materialize the ordered corpus, leaving completion reads to copy a ready view.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A retained corpus is described as last-good rather than falsely current after a failed producer call.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain asynchronous availability and refresh behavior, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The accessor handles protocol data only; producer execution owns the native boundary.
// @evidence contracts/performance.md#efficient-algorithms Copying H groups and I items is O(H+I) time and returned storage; the accessor does not rebuild producer ordering.
// @evidence contracts/performance.md#reuse-equivalent-work All requests share the flattened last-good corpus until a successful producer refresh replaces its generation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned slices belong to the caller; corpus stores and source Close own retained state.
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
  for index := range out {
    out[index].Items = append([]LSPCompletionItem(nil), out[index].Items...)
  }
  return out
}

// RefreshCompletionHints schedules one asynchronous corpus rediscovery.
//
// The corpus is a projection of what a project rule's Check found, so it goes
// stale the moment the rule's inputs change: a saved contributor-indexed
// document, a rule enabled in `lint.config.*`, a watched file rewritten outside
// the editor. Without this the corpus would stay a session snapshot and only a
// language-server restart could replace it.
//
// Asynchronous for the same reason the first fetch is (see CompletionHints):
// the editor event that schedules a refresh must not wait for a Program load.
// Concurrent requests coalesce into at most one queued rerun, so a save storm
// costs one extra refresh rather than one per notification, and the previous
// corpus keeps answering completion until the new one lands.
//
// @evidence contracts/common.md#principled-implementation Serial refresh generations update producer records only after successful decoding; a queued rerun observes changes reported during the active cycle.
// @evidence contracts/common.md#clear-and-simple-design One coalescing scheduler serves startup and later notifications.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Last-good retention follows explicit failed-refresh policy rather than masking a failure as a successful empty result.
// @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain invalidation, nonblocking scheduling and coalescing, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Shared native command execution owns executable/argv differences; scheduling does not derive filesystem capabilities from OS labels.
// @evidence contracts/performance.md#efficient-algorithms A refresh queries distinct transports and flattens producer corpora; total work scales with producer responses and retained item population.
// @evidence contracts/performance.md#reuse-equivalent-work Concurrent notifications share one active cycle and at most one rerun, while successful stores expose the latest producer generation.
// @evidence contracts/performance.md#bound-retention-and-release-resources One worker and one pending rerun per source bound scheduled refresh count; Close rejects new schedules and cancels native work. Corpus bytes have producer output caps but no separate aggregate budget.
func (s *NativePluginSource) RefreshCompletionHints() {
  if s == nil || len(s.plugins) == 0 {
    return
  }
  s.hintsRefresh.schedule(s.discoverCompletionHints)
}

// SetCompletionHintsObserver registers fn to run after each completed refresh
// cycle. The proxy uses it to notice a trigger character that appeared after
// the initialize response was already sent. A nil fn clears the observer.
//
// @evidence contracts/common.md#principled-implementation The locked observer slot atomically replaces callback ownership; nil removes future notifications, though a callback already copied by a refresh may finish.
// @evidence contracts/common.md#clear-and-simple-design One callback boundary lets the proxy react without exposing corpus storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported observation avoids patching producer refresh methods.
// @evidence contracts/common.md#meaningful-documentation Native prose states notification timing and nil removal, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Callback registration performs no native interpretation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Assigning an observer chooses no processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Refresh scheduling owns coalesced work rather than this callback setter.
// @evidence contracts/performance.md#bound-retention-and-release-resources One function reference is retained, replaced or cleared under hintsMu; already running callback execution is not joined here.
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
  for _, plugin := range selectPluginTransports(
    s.plugins,
    nil,
    s.projectContextJSON,
  ) {
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
  key := pluginKey(plugin, s.projectContextJSON)
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
  for _, plugin := range selectPluginTransports(
    s.plugins,
    nil,
    s.projectContextJSON,
  ) {
    key := pluginKey(plugin, s.projectContextJSON)
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

// pluginKey identifies one effective native launch transport. Every LSP verb
// receives the full plugin manifest and has no selected-entry argument, so two
// logical entries using the same binary and project-context argv return one
// aggregate result and must share one cache, owner scope, and resident daemon.
func pluginKey(
  plugin NativeLSPPluginEntry,
  projectContextJSON ...string,
) string {
  projectContextArgs := "0"
  if plugin.ProjectContextArgs &&
    len(projectContextJSON) != 0 &&
    strings.TrimSpace(projectContextJSON[0]) != "" {
    projectContextArgs = "1"
  }
  return plugin.Binary + "\x00" + projectContextArgs
}

// selectPluginTransports preserves manifest order while selecting at most one
// representative for each effective native launch identity.
func selectPluginTransports(
  plugins []NativeLSPPluginEntry,
  include func(NativeLSPPluginEntry) bool,
  projectContextJSON ...string,
) []NativeLSPPluginEntry {
  selected := make([]NativeLSPPluginEntry, 0, len(plugins))
  seen := make(map[string]struct{}, len(plugins))
  for _, plugin := range plugins {
    if include != nil && !include(plugin) {
      continue
    }
    key := pluginKey(plugin, projectContextJSON...)
    if _, duplicate := seen[key]; duplicate {
      continue
    }
    seen[key] = struct{}{}
    selected = append(selected, plugin)
  }
  return selected
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
//
// @evidence contracts/common.md#principled-implementation Copying discovered kinds prevents callers from mutating source advertisement state.
// @evidence contracts/common.md#clear-and-simple-design Capability discovery owns selection; the accessor exposes a ready list.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Kinds come from producer capabilities rather than package-specific substitutions.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies discovered action kinds, following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Action-kind strings are protocol values with no native boundary.
// @evidence contracts/performance.md#efficient-algorithms The N-kind copy is O(N) time and returned space.
// @evidence contracts/performance.md#reuse-equivalent-work Immutable session descriptors permit reuse of construction-time capabilities.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned copy transfers ownership; the source owns its original list.
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
  for _, plugin := range selectPluginTransports(
    s.plugins,
    nil,
    s.projectContextJSON,
  ) {
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
  return pluginKey(owner, s.projectContextJSON) ==
    pluginKey(plugin, s.projectContextJSON)
}

func (s *NativePluginSource) run(plugin NativeLSPPluginEntry, command string, args ...string) ([]byte, error) {
  // Route the Program-loading read verbs through the plugin's resident daemon so
  // a warm Program is reused across verbs. serveRun returns served=false for a
  // sidecar that predates lsp-serve or a transport failure, falling back to the
  // spawn-per-verb path below with no behavior change. The static discovery
  // verbs (lsp-command-ids / lsp-code-action-kinds) and lsp-execute-command stay
  // on exec by design.
  if command == serveVerbDiagnostics ||
    command == serveVerbCodeActions {
    if body, served, err := s.serveRun(plugin, command, args); served {
      return body, err
    }
  }
  if command == serveVerbProjectDiagnostics ||
    command == serveVerbHints {
    // These newer optional verbs join the daemon on a weaker condition than the
    // original document reads. A staged sidecar may implement the direct verb
    // while its older resident loop rejects it. A nonzero resident reply is
    // indistinguishable from the verb itself failing, so retry once through the
    // advertised direct command. A genuine failure pays one extra spawn and is
    // then handled exactly as it was before lsp-serve.
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
  // Rules have no computation deadline, but session teardown cancels their
  // processes. WaitDelay bounds pipe draining after exit or cancellation when
  // a descendant inherited the child's output handles.
  ctx := s.commandContext()
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
  cmd.WaitDelay = time.Second
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
