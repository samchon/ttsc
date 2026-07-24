package lspserver

import "testing"

type projectDiagnosticsResumeSource struct {
  NullPluginSource
}

func (projectDiagnosticsResumeSource) ProjectDiagnostics() *LSPProjectDiagnostics {
  return nil
}

// TestResumePendingProjectDiagnosticRefreshDoesNotReviveCompletedWork verifies
// a save or close advances and rearms pending work atomically, while a refresh
// completed before that transition remains completed.
func TestResumePendingProjectDiagnosticRefreshDoesNotReviveCompletedWork(
  t *testing.T,
) {
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
  if after != before+1 {
    t.Fatalf("resume advanced generation from %d to %d", before, after)
  }
  proxy.projectRefreshMu.Lock()
  pending := proxy.projectDiagnosticRefreshPending
  generation := proxy.pendingProjectDiagnosticGeneration
  proxy.projectRefreshMu.Unlock()
  if !pending {
    t.Fatal("resume cleared the pending refresh")
  }
  proxy.completePendingProjectDiagnosticRefresh(generation)
  proxy.resumePendingProjectDiagnosticRefresh()
  proxy.diagnosticsMu.Lock()
  final := proxy.projectDiagnosticGeneration
  proxy.diagnosticsMu.Unlock()
  if final != after {
    t.Fatalf("completed refresh was revived at generation %d", final)
  }
}
