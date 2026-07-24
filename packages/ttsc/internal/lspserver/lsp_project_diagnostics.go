package lspserver

import "encoding/json"

// projectDiagnosticRecord is one producer's last successful project
// publication. A failed refresh never updates the record, so another producer's
// success cannot erase diagnostics that were still valid before the failure.
type projectDiagnosticRecord struct {
  generation  uint64
  publication LSPProjectDiagnostics
}

type projectDiagnosticsRefreshResult struct {
  publication *LSPProjectDiagnostics
  refreshed   map[string]struct{}
  complete    bool
  selected    int
}

// ProjectDiagnostics evaluates project rules without requiring an open
// document and returns the latest successful publication from every capable
// sidecar.
func (s *NativePluginSource) ProjectDiagnostics() *LSPProjectDiagnostics {
  return s.ProjectDiagnosticsForOwners(nil).publication
}

// ProjectDiagnosticsForOwners refreshes only the diagnostics-capable producers
// named by owners. A nil owner list preserves the legacy all-producer request;
// an empty non-nil list is a successful no-op.
func (s *NativePluginSource) ProjectDiagnosticsForOwners(
  owners []string,
) projectDiagnosticsRefreshResult {
  if s == nil {
    return projectDiagnosticsRefreshResult{}
  }
  selectedOwners := map[string]struct{}{}
  if owners != nil {
    for _, owner := range owners {
      selectedOwners[owner] = struct{}{}
    }
  }
  generation := s.projectDiagnosticsSequence.Add(1)
  result := projectDiagnosticsRefreshResult{
    complete:  true,
    refreshed: map[string]struct{}{},
  }
  for _, plugin := range selectPluginTransports(
    s.plugins,
    func(plugin NativeLSPPluginEntry) bool {
      return plugin.ProjectDiagnostics
    },
    s.projectContextJSON,
  ) {
    key := pluginKey(plugin, s.projectContextJSON)
    if owners != nil {
      if _, selected := selectedOwners[key]; !selected {
        continue
      }
    }
    result.selected++
    body, err := s.run(plugin, serveVerbProjectDiagnostics)
    if err != nil {
      s.log("%v", err)
      result.complete = false
      continue
    }
    var publication *LSPProjectDiagnostics
    if err := json.Unmarshal(body, &publication); err != nil {
      s.log(
        "ttscserver: %s lsp-project-diagnostics returned invalid JSON: %v",
        pluginLabel(plugin),
        err,
      )
      result.complete = false
      continue
    }
    if publication == nil || publication.URI == "" {
      result.complete = false
      continue
    }
    s.storeProjectDiagnostics(plugin, generation, publication)
    result.refreshed[key] = struct{}{}
  }
  result.publication = s.projectDiagnosticsSnapshot()
  return result
}

// storeProjectDiagnostics replaces one producer's last-good publication. A
// successful empty diagnostics array clears that producer while leaving every
// other producer unchanged.
func (s *NativePluginSource) storeProjectDiagnostics(
  plugin NativeLSPPluginEntry,
  generation uint64,
  publication *LSPProjectDiagnostics,
) {
  if publication == nil || publication.URI == "" {
    return
  }
  key := pluginKey(plugin, s.projectContextJSON)
  copied := copyProjectDiagnostics(publication)
  s.projectDiagnosticsMu.Lock()
  defer s.projectDiagnosticsMu.Unlock()
  if existing, ok := s.pluginProjectDiagnostics[key]; ok &&
    generation < existing.generation {
    return
  }
  if s.pluginProjectDiagnostics == nil {
    s.pluginProjectDiagnostics = map[string]projectDiagnosticRecord{}
  }
  s.pluginProjectDiagnostics[key] = projectDiagnosticRecord{
    generation:  generation,
    publication: *copied,
  }
}

// projectDiagnosticsSnapshot concatenates producer publications in manifest
// order. A project has one config URI, so a producer that reports a different
// URI is excluded and logged rather than replacing the other producers.
func (s *NativePluginSource) projectDiagnosticsSnapshot() *LSPProjectDiagnostics {
  s.projectDiagnosticsMu.RLock()
  defer s.projectDiagnosticsMu.RUnlock()
  var out *LSPProjectDiagnostics
  for _, plugin := range selectPluginTransports(
    s.plugins,
    nil,
    s.projectContextJSON,
  ) {
    key := pluginKey(plugin, s.projectContextJSON)
    record, ok := s.pluginProjectDiagnostics[key]
    if !ok {
      continue
    }
    publication := record.publication
    if out == nil {
      out = copyProjectDiagnostics(&publication)
      continue
    }
    if out.URI != publication.URI {
      s.log(
        "ttscserver: %s lsp-project-diagnostics returned URI %q, want %q",
        pluginLabel(plugin),
        publication.URI,
        out.URI,
      )
      continue
    }
    out.Diagnostics = append(out.Diagnostics, publication.Diagnostics...)
  }
  return out
}

func copyProjectDiagnostics(
  publication *LSPProjectDiagnostics,
) *LSPProjectDiagnostics {
  if publication == nil {
    return nil
  }
  copied := *publication
  copied.Diagnostics = append(
    []LSPDiagnostic(nil),
    publication.Diagnostics...,
  )
  return &copied
}
