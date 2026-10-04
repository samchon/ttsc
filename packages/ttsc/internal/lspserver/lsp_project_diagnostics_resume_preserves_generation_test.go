package lspserver

import "testing"

type projectDiagnosticsResumeSource struct {
  NullPluginSource
}

func (projectDiagnosticsResumeSource) ProjectDiagnostics() *LSPProjectDiagnostics {
  return nil
}

// TestResumePendingProjectDiagnosticRefreshDoesNotReviveCompletedWork verifies
// direct resume advances pending work, while a refresh marked complete before
// the next direct resume remains complete. Actual save/close dispatch and
// concurrent atomicity are not exercised.
//
// @evidence contracts/testing.md#behavioral-verification Direct resume advances an observed pending generation by one and keeps pending=true; after explicit completion, another direct resume must leave the generation unchanged. Timer rearming, actual save/close routing and concurrent interleavings are not asserted.
// @evidence contracts/testing.md#independent-expectations Authored arithmetic before+1 and final=after, plus literal pending=true, distinguish progression from revival without reusing a generation calculation helper. Completion receives the actual retained pending generation.
// @evidence contracts/testing.md#distinguishing-cases Pending work and already completed work have different generation outcomes in the sequential schedule/resume/complete/resume sequence. Dirty-document refusal and concurrent completion are not exercised.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit calls actual Proxy scheduling and resume/completion methods with an owned source returning nil diagnostics. Scheduling arms the real timer and asynchronous scheduler; deferred stop clears pending state and closes admission without certifying callback join. No native child, sidecar, temporary project, installed consumer or product host runs and no operation is replaced.
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
