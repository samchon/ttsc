package lspserver

import "testing"

type projectDiagnosticsResumeSource struct {
  NullPluginSource
}

func (projectDiagnosticsResumeSource) ProjectDiagnostics() *LSPProjectDiagnostics {
  return nil
}

// TestResumePendingProjectDiagnosticRefreshPreservesGeneration verifies a
// save or close rearms the existing pending refresh atomically instead of
// creating a newer generation after another path has completed it.
func TestResumePendingProjectDiagnosticRefreshPreservesGeneration(t *testing.T) {
  proxy := NewProxy(ProxyOptions{
    Source: projectDiagnosticsResumeSource{},
  })
  defer proxy.stopProjectDiagnosticRefresh()

  proxy.scheduleProjectDiagnosticRefresh(projectDiagnosticOwnerScope{all: true})
  proxy.diagnosticsMu.Lock()
  before := proxy.projectDiagnosticGeneration
  proxy.diagnosticsMu.Unlock()

  proxy.resumePendingProjectDiagnosticRefresh()

  proxy.diagnosticsMu.Lock()
  after := proxy.projectDiagnosticGeneration
  proxy.diagnosticsMu.Unlock()
  if after != before {
    t.Fatalf("resume advanced generation from %d to %d", before, after)
  }
  proxy.projectRefreshMu.Lock()
  pending := proxy.projectDiagnosticRefreshPending
  proxy.projectRefreshMu.Unlock()
  if !pending {
    t.Fatal("resume cleared the pending refresh")
  }
}
