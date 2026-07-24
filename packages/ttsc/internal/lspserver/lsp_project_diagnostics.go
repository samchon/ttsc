package lspserver

import "encoding/json"

// projectDiagnosticRecord is one producer's last successful project
// publication. A failed refresh never updates the record, so another producer's
// success cannot erase diagnostics that were still valid before the failure.
type projectDiagnosticRecord struct {
  generation  uint64
  publication LSPProjectDiagnostics
}

// ProjectDiagnostics evaluates project rules without requiring an open
// document and returns the latest successful publication from every capable
// sidecar.
func (s *NativePluginSource) ProjectDiagnostics() *LSPProjectDiagnostics {
  if s == nil {
    return nil
  }
  generation := s.projectDiagnosticsSequence.Add(1)
  for _, plugin := range s.plugins {
    if !plugin.ProjectDiagnostics {
      continue
    }
    body, err := s.run(plugin, serveVerbProjectDiagnostics)
    if err != nil {
      s.log("%v", err)
      continue
    }
    var publication *LSPProjectDiagnostics
    if err := json.Unmarshal(body, &publication); err != nil {
      s.log(
        "ttscserver: %s lsp-project-diagnostics returned invalid JSON: %v",
        pluginLabel(plugin),
        err,
      )
      continue
    }
    if publication == nil || publication.URI == "" {
      continue
    }
    s.storeProjectDiagnostics(plugin, generation, publication)
  }
  return s.projectDiagnosticsSnapshot()
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
  key := pluginKey(plugin)
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
  seen := make(map[string]struct{}, len(s.plugins))
  for _, plugin := range s.plugins {
    key := pluginKey(plugin)
    if _, duplicate := seen[key]; duplicate {
      continue
    }
    seen[key] = struct{}{}
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
