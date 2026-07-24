package driver_test

import (
  "encoding/json"
  "sync"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type externalProjectDiagnosticsSource struct {
  stubSource

  mu                sync.Mutex
  externalURI       string
  diagnosticsCalls  int
  invalidated       [][]string
  invalidatedInputs [][]string
  refreshCalls      int
}

type decodedProjectPublication struct {
  URI         string
  Diagnostics []json.RawMessage
}

func (s *externalProjectDiagnosticsSource) ProjectInputMatchesURI(uri string) bool {
  return uri == s.externalURI
}

func (s *externalProjectDiagnosticsSource) RefreshProjectInputs() {
  s.mu.Lock()
  s.refreshCalls++
  s.mu.Unlock()
}

func (s *externalProjectDiagnosticsSource) ProjectDiagnostics() *driver.LSPProjectDiagnostics {
  s.mu.Lock()
  defer s.mu.Unlock()
  s.diagnosticsCalls++
  publication := &driver.LSPProjectDiagnostics{
    URI:         "file:///project/tsconfig.json",
    Diagnostics: []driver.LSPDiagnostic{},
  }
  if s.diagnosticsCalls == 1 {
    publication.Diagnostics = append(
      publication.Diagnostics,
      driver.LSPDiagnostic{
        Code:     "demo/external",
        Source:   "@ttsc/lint",
        Severity: driver.LSPDiagnosticSeverityError,
        Message:  "external input changed",
      },
    )
  }
  return publication
}

func (s *externalProjectDiagnosticsSource) InvalidateResidentProgramsForWatchedChanges(
  changedURIs []string,
  externalURIs []string,
) {
  s.mu.Lock()
  defer s.mu.Unlock()
  s.invalidated = append(s.invalidated, append([]string(nil), changedURIs...))
  s.invalidatedInputs = append(
    s.invalidatedInputs,
    append([]string(nil), externalURIs...),
  )
}

// TestLSPProxyExternalInputRefreshesProjectDiagnosticsWithoutOpenDocument
// verifies a declared watched-file event immediately replaces project
// diagnostics without borrowing a source-document URI.
//
// External events are debounced, tagged for resident Program retention, and
// generation-guarded. An unrelated broad-watcher event must not run project
// contributors or publish another frame.
//
//  1. Send one declared external event with no open document and observe it.
//  2. Send a created/deleted burst and assert one empty replacement publication.
//  3. Send unrelated local and remote events and keep contributors quiet.
func TestLSPProxyExternalInputRefreshesProjectDiagnosticsWithoutOpenDocument(t *testing.T) {
  const externalURI = "file:///project/docs/spec.md"
  source := &externalProjectDiagnosticsSource{externalURI: externalURI}
  h := newProxyHarness(t, source)

  sendWatchedFileChange(t, h, externalURI)
  first := decodeProjectPublication(t, h.recvEditor())
  if first.URI != "file:///project/tsconfig.json" ||
    len(first.Diagnostics) != 1 {
    t.Fatalf("first project publication = %#v", first)
  }

  sendWatchedFileChangeOfType(t, h, externalURI, 1)
  sendWatchedFileChangeOfType(t, h, externalURI, 3)
  cleared := decodeProjectPublication(t, h.recvEditor())
  if cleared.URI != "file:///project/tsconfig.json" ||
    len(cleared.Diagnostics) != 0 {
    t.Fatalf("clearing project publication = %#v", cleared)
  }

  source.mu.Lock()
  calls := source.diagnosticsCalls
  invalidated := append([][]string(nil), source.invalidatedInputs...)
  source.mu.Unlock()
  if calls != 2 {
    t.Fatalf("project diagnostics calls = %d, want 2", calls)
  }
  for index, uris := range invalidated {
    if len(uris) != 1 || uris[0] != externalURI {
      t.Fatalf("external invalidation %d = %#v", index, uris)
    }
  }

  sendWatchedFileChange(t, h, "file:///project/README.md")
  sendWatchedFileChange(t, h, "https://example.com/openapi.json")
  h.expectNoEditorFrame(150 * time.Millisecond)
  source.mu.Lock()
  defer source.mu.Unlock()
  if source.diagnosticsCalls != calls {
    t.Fatalf(
      "unrelated wildcard event ran project diagnostics: %d -> %d",
      calls,
      source.diagnosticsCalls,
    )
  }
}

func sendWatchedFileChange(
  t *testing.T,
  h *proxyHarness,
  uri string,
) {
  sendWatchedFileChangeOfType(t, h, uri, 2)
}

func sendWatchedFileChangeOfType(
  t *testing.T,
  h *proxyHarness,
  uri string,
  changeType int,
) {
  t.Helper()
  body, err := json.Marshal(map[string]any{
    "jsonrpc": "2.0",
    "method":  "workspace/didChangeWatchedFiles",
    "params": map[string]any{
      "changes": []map[string]any{{"uri": uri, "type": changeType}},
    },
  })
  if err != nil {
    t.Fatal(err)
  }
  h.sendEditor(body)
  _ = h.recvUpstream()
}

func decodeProjectPublication(
  t *testing.T,
  body []byte,
) decodedProjectPublication {
  t.Helper()
  var envelope struct {
    Params struct {
      URI         string            `json:"uri"`
      Diagnostics []json.RawMessage `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &envelope); err != nil {
    t.Fatalf("decode project publication: %v\n%s", err, body)
  }
  return decodedProjectPublication{
    URI:         envelope.Params.URI,
    Diagnostics: envelope.Params.Diagnostics,
  }
}
