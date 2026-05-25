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
  Plugins    []NativePluginConfigEntry `json:"plugins"`
  LSPPlugins []NativeLSPPluginEntry    `json:"lspPlugins"`
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
  Binary string `json:"binary"`
  Name   string `json:"name,omitempty"`
  Stage  string `json:"stage,omitempty"`
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
  cwd         string
  err         io.Writer
  plugins     []NativeLSPPluginEntry
  pluginsJSON string
  tsconfig    string

  commandIDs      []string
  codeActionKinds []string
  owners          map[string]NativeLSPPluginEntry
  logMu           sync.Mutex
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
  source := &NativePluginSource{
    cwd:         opts.Cwd,
    err:         opts.Err,
    plugins:     manifest.LSPPlugins,
    pluginsJSON: string(pluginsJSON),
    tsconfig:    opts.Tsconfig,
    owners:      map[string]NativeLSPPluginEntry{},
  }
  source.discoverCommandIDs()
  return source, nil
}

// Diagnostics asks every LSP-capable sidecar for diagnostics matching doc.URI.
func (s *NativePluginSource) Diagnostics(doc LSPDocumentVersion) []LSPDiagnostic {
  if s == nil || doc.URI == "" {
    return nil
  }
  var out []LSPDiagnostic
  for _, plugin := range s.plugins {
    body, err := s.run(plugin, "lsp-diagnostics", "--uri="+doc.URI)
    if err != nil {
      s.log("%v", err)
      continue
    }
    var diagnostics []LSPDiagnostic
    if err := json.Unmarshal(body, &diagnostics); err != nil {
      s.log("ttscserver: %s lsp-diagnostics returned invalid JSON: %v", pluginLabel(plugin), err)
      continue
    }
    out = append(out, diagnostics...)
  }
  return out
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
  if s == nil {
    return nil, ErrCommandNotHandled
  }
  plugin, ok := s.owners[command]
  if !ok {
    return nil, ErrCommandNotHandled
  }
  argsJSON, _ := json.Marshal(args)
  body, err := s.run(
    plugin,
    "lsp-execute-command",
    "--command="+command,
    "--arguments-json="+string(argsJSON),
  )
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
  allArgs = append(allArgs, args...)
  cmd := exec.CommandContext(ctx, plugin.Binary, allArgs...)
  cmd.Dir = s.cwd
  cmd.Env = os.Environ()
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
