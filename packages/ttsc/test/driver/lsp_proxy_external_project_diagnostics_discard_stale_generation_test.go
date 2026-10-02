package driver_test

import (
  "sync"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type slowExternalProjectDiagnosticsSource struct {
  stubSource

  mu          sync.Mutex
  calls       int
  externalURI string
  started     chan struct{}
  release     chan struct{}
}

func (s *slowExternalProjectDiagnosticsSource) ProjectInputMatchesURI(uri string) bool {
  return uri == s.externalURI
}

func (s *slowExternalProjectDiagnosticsSource) RefreshProjectInputs() {}

func (s *slowExternalProjectDiagnosticsSource) ProjectDiagnostics() *driver.LSPProjectDiagnostics {
  s.mu.Lock()
  s.calls++
  call := s.calls
  s.mu.Unlock()
  if call == 1 {
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

func (s *slowExternalProjectDiagnosticsSource) InvalidateResidentProgramsForWatchedChanges(
  []string,
  []string,
) {
}

// TestLSPProxyExternalProjectDiagnosticsDiscardStaleGeneration Verifies an
// older slow computation cannot publish after a newer external event.
//
// Filesystem bursts can arrive while a sidecar is still evaluating project
// rules. The generation guard must discard that result and let the coalesced
// rerun publish the newest replacement exactly once.
//
//  1. Start one external refresh and block its source callback.
//  2. Report a newer event before releasing the stale computation.
//  3. Observe only the empty publication from the queued latest generation.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run performs two external refresh calls, publishes only the empty current result at the config URI, and produces no further frame within 150ms.
// @evidence contracts/testing.md#independent-expectations The controlled first callback contributes stale while its successor is empty; a later watched event must make the first publication ineligible.
// @evidence contracts/testing.md#distinguishing-cases A second event during blocked first work exercises coalesced rerun and exact two-call count; the trailing silence check has a bounded window.
// @evidence contracts/testing.md#execution-ownership Go test/driver drives watched-file frames through the pipe proxy with an in-memory project diagnostic source, not a filesystem watcher service.
func TestLSPProxyExternalProjectDiagnosticsDiscardStaleGeneration(t *testing.T) {
  const externalURI = "file:///project/docs/spec.md"
  source := &slowExternalProjectDiagnosticsSource{
    externalURI: externalURI,
    started:     make(chan struct{}),
    release:     make(chan struct{}),
  }
  h := newProxyHarness(t, source)
  var releaseOnce sync.Once
  releaseCallback := func() { releaseOnce.Do(func() { close(source.release) }) }
  t.Cleanup(releaseCallback)

  sendWatchedFileChange(t, h, externalURI)
  select {
  case <-source.started:
  case <-time.After(2 * time.Second):
    t.Fatal("first project diagnostics computation did not start")
  }
  sendWatchedFileChange(t, h, externalURI)
  releaseCallback()

  deadline := time.Now().Add(2 * time.Second)
  for {
    source.mu.Lock()
    calls := source.calls
    source.mu.Unlock()
    if calls >= 2 {
      break
    }
    if time.Now().After(deadline) {
      t.Fatalf("queued project diagnostics did not run: calls=%d", calls)
    }
    time.Sleep(10 * time.Millisecond)
  }
  publication := decodeProjectPublication(t, h.recvEditor())
  if publication.URI != "file:///project/tsconfig.json" ||
    len(publication.Diagnostics) != 0 {
    t.Fatalf("latest project publication = %#v", publication)
  }
  h.expectNoEditorFrame(150 * time.Millisecond)
  source.mu.Lock()
  defer source.mu.Unlock()
  if source.calls != 2 {
    t.Fatalf("project diagnostics calls = %d, want 2", source.calls)
  }
}
