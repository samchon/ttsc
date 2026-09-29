package lspserver

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
)

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
//
// @evidence contracts/common.md#principled-implementation Nil owner selection requests all capable producers and returns the aggregate publication separately from refresh bookkeeping.
// @evidence contracts/common.md#clear-and-simple-design The owner-aware operation is the single implementation of project diagnostics refresh.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This legacy entry shares the same producer policy rather than compensating with another query path.
// @evidence contracts/common.md#meaningful-documentation Native prose states document-independent and last-successful publication behavior, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The delegated owner-aware operation owns native execution and logical config URI translation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Owner-aware refresh chooses query and aggregation algorithms.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The delegated refresh owns resident sharing and generation validity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Child and publication lifetimes belong to the delegated source operation.
func (s *NativePluginSource) ProjectDiagnostics() *LSPProjectDiagnostics {
  return s.ProjectDiagnosticsForOwners(nil).publication
}

// ProjectDiagnosticsForOwners refreshes only the diagnostics-capable producers
// named by owners. A nil owner list preserves the legacy all-producer request;
// an empty non-nil list is a successful no-op.
//
// @evidence contracts/common.md#principled-implementation Nil owners means all while empty non-nil means none; generation-guarded successful stores preserve independent last-good producers and record which were actually refreshed.
// @evidence contracts/common.md#clear-and-simple-design Selection, producer execution and aggregate publication remain one transaction with separate refresh completeness metadata.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Failed producers are not reported as successful clears; optional verb fallback addresses older resident protocol support explicitly.
// @evidence contracts/common.md#meaningful-documentation Native prose states owner-list distinctions, following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Sidecar physical project identity is checked natively before translation to the client's logical config URI; native argv remains separate from protocol URIs.
// @evidence contracts/performance.md#efficient-algorithms Owner-set lookup is constant-time per distinct transport; output aggregation is linear in retained producer diagnostic count.
// @evidence contracts/performance.md#reuse-equivalent-work Resident read verbs share valid Program state; per-producer generations reject older writes and untouched owners retain explicitly last-good publications.
// @evidence contracts/performance.md#bound-retention-and-release-resources One last-good publication per producer persists for the source lifetime; output caps bound individual responses and Close cancels/waits children. Concurrent refresh requests and aggregate bytes have no independent budget.
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

// clientProjectURI restates a producer's project URI in the spelling the client
// opened the project under.
//
// A sidecar is deliberately given the project's physical paths, because that is
// what makes its compiler, its caches, and its own resolution agree with every
// other consumer. The editor never saw those paths. It opened the project under
// whatever spelling its workspace uses — through a symlink, a mapped drive, a
// case that differs — and a publication addressed to any other spelling is
// invisible to it no matter how correct the diagnostics inside are. So the one
// place the two worlds meet translates back.
func (s *NativePluginSource) clientProjectURI(uri string) string {
  if s == nil || uri == "" {
    return uri
  }
  client, key := s.clientProjectIdentity()
  if client == "" {
    return uri
  }
  location, ok := filePathFromURI(uri)
  if !ok {
    return uri
  }
  if projectInputPathKey(realProjectInputPath(location)) != key {
    return uri
  }
  return projectInputFileURI(client)
}

// clientProjectIdentity is the project as the client named it, absolute, with
// the key a producer's URI is compared against. Empty when the client named no
// project at all, which is the one case where there is nothing to translate to.
func (s *NativePluginSource) clientProjectIdentity() (string, string) {
  s.clientProjectOnce.Do(func() {
    client := projectInputFilesystemPath(strings.TrimSpace(s.clientTsconfig))
    if client == "" {
      return
    }
    if !filepath.IsAbs(client) {
      // The client names its project relative to the directory it asked this
      // host to work in. When it named none, the host was started from that
      // directory and inherited it, so the process directory is not a guess
      // here — it is the same answer by another route.
      base := projectInputFilesystemPath(strings.TrimSpace(s.clientCwd))
      if base == "" {
        working, err := os.Getwd()
        if err != nil {
          return
        }
        base = working
      }
      absolute, err := filepath.Abs(base)
      if err != nil {
        return
      }
      client = filepath.Join(absolute, client)
    }
    if !filepath.IsAbs(client) {
      return
    }
    s.clientProject = client
    s.clientProjectKey = projectInputPathKey(realProjectInputPath(client))
  })
  return s.clientProject, s.clientProjectKey
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
    publication.URI = s.clientProjectURI(publication.URI)
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
