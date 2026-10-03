package driver_test

import (
  "sync"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type savedExternalProjectDiagnosticsRaceSource struct {
  stubSource

  mu          sync.Mutex
  calls       int
  externalURI string
  started     chan struct{}
  release     chan struct{}
}

func (s *savedExternalProjectDiagnosticsRaceSource) ProjectInputMatchesURI(uri string) bool {
  return uri == s.externalURI
}

func (*savedExternalProjectDiagnosticsRaceSource) RefreshProjectInputs() {}

func (s *savedExternalProjectDiagnosticsRaceSource) ProjectDiagnostics() *driver.LSPProjectDiagnostics {
  s.mu.Lock()
  s.calls++
  call := s.calls
  s.mu.Unlock()
  if call == 2 {
    close(s.started)
    <-s.release
  }
  publication := &driver.LSPProjectDiagnostics{
    URI:         "file:///project/tsconfig.json",
    Diagnostics: []driver.LSPDiagnostic{},
  }
  if call == 1 {
    publication.Diagnostics = append(
      publication.Diagnostics,
      driver.LSPDiagnostic{
        Code:     "demo/stale",
        Source:   "@ttsc/lint",
        Severity: driver.LSPDiagnosticSeverityError,
        Message:  "stale external result",
      },
    )
  }
  return publication
}

func (*savedExternalProjectDiagnosticsRaceSource) InvalidateResidentProgramsForWatchedChanges(
  []string,
  []string,
) {
}

// TestLSPProxyResumesSavedExternalProjectDiagnosticsAfterGenerationRejection Verifies that a generation-rejected project clear is retried after save, clears the publication, and makes exactly three direct calls.
//
// Dirty deferral, blocked resumed refresh, newer publication, and retry form one transition chain.
//
// 1. Publish one project finding, dirty a document, and defer an external refresh.
// 2. Save, block the resumed direct clear, and advance the document generation with a project-omitting diagnostics response.
// 3. Release the rejected clear and observe a fresh direct run clear the finding.
//
// @evidence contracts/testing.md#behavioral-verification A generation-rejected project clear is retried after save, clears the publication, and makes exactly three direct calls.
// @evidence contracts/testing.md#independent-expectations The authored finding and later empty sets define replacement semantics; channels establish generation ordering.
// @evidence contracts/testing.md#distinguishing-cases Dirty deferral, blocked resumed refresh, newer publication, and retry form one transition chain.
// @evidence contracts/testing.md#execution-ownership A specialized Go stub and pipe proxy use mutex counters and channel-controlled release without a native producer. Go discovers TestLSPProxyResumesSavedExternalProjectDiagnosticsAfterGenerationRejection under ./test/driver.
func TestLSPProxyResumesSavedExternalProjectDiagnosticsAfterGenerationRejection(t *testing.T) {
  const externalURI = "file:///project/docs/spec.md"
  const documentURI = "file:///project/src/dirty.ts"
  source := &savedExternalProjectDiagnosticsRaceSource{
    externalURI: externalURI,
    started:     make(chan struct{}),
    release:     make(chan struct{}),
  }
  var releaseOnce sync.Once
  releaseCallback := func() { releaseOnce.Do(func() { close(source.release) }) }
  t.Cleanup(releaseCallback)
  defer releaseCallback()
  source.diagnosticsResultFor = func(driver.LSPDocumentVersion) driver.LSPDiagnosticsResult {
    // This is the shape lsp-diagnostics returns when parse diagnostics prevent
    // the project-rule cycle from running: document diagnostics exist, but the
    // project publication is omitted.
    return driver.LSPDiagnosticsResult{Document: []driver.LSPDiagnostic{}}
  }
  h := newProxyHarness(t, source)

  sendWatchedFileChange(t, h, externalURI)
  initial := decodeProjectPublication(t, h.recvEditor())
  if initial.URI != "file:///project/tsconfig.json" ||
    len(initial.Diagnostics) != 1 {
    t.Fatalf("initial project publication = %#v", initial)
  }

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///project/src/dirty.ts","version":1,"languageId":"typescript","text":"unsaved"}}}`))
  _ = h.recvUpstream()
  sendWatchedFileChange(t, h, externalURI)
  time.Sleep(150 * time.Millisecond)
  source.mu.Lock()
  callsWhileDirty := source.calls
  source.mu.Unlock()
  if callsWhileDirty != 1 {
    t.Fatalf("project diagnostics calls while dirty = %d, want 1", callsWhileDirty)
  }

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///project/src/dirty.ts","version":2}}}`))
  _ = h.recvUpstream()
  select {
  case <-source.started:
  case <-time.After(2 * time.Second):
    t.Fatal("didSave did not resume the pending direct project refresh")
  }

  h.sendUpstream([]byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///project/src/dirty.ts","version":2,"diagnostics":[]}}`))
  _ = h.recvEditor()
  releaseCallback()

  cleared := decodeProjectPublication(t, h.recvEditor())
  if cleared.URI != "file:///project/tsconfig.json" ||
    len(cleared.Diagnostics) != 0 {
    t.Fatalf("retried project publication = %#v", cleared)
  }
  source.mu.Lock()
  calls := source.calls
  source.mu.Unlock()
  if calls != 3 {
    t.Fatalf("project diagnostics calls = %d, want 3", calls)
  }
}
