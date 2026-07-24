package lspserver

import "testing"

// TestProjectDiagnosticsRefreshAccumulatesOwnerFreshness verifies separate
// successful refreshes can jointly satisfy one affected-producer generation.
func TestProjectDiagnosticsRefreshAccumulatesOwnerFreshness(t *testing.T) {
  proxy := &Proxy{}
  proxy.projectDiagnosticRefreshPending = true
  proxy.pendingProjectDiagnosticGeneration = 2
  proxy.pendingProjectDiagnosticOwners = map[string]struct{}{
    "alpha": {},
    "beta":  {},
  }

  if proxy.recordPendingProjectDiagnosticOwnersRefreshed(
    1,
    map[string]struct{}{"beta": {}},
  ) {
    t.Fatal("stale producer refresh completed the newer generation")
  }
  if _, pending := proxy.pendingProjectDiagnosticOwners["beta"]; !pending {
    t.Fatal("stale producer refresh removed a newer pending owner")
  }
  if proxy.recordPendingProjectDiagnosticOwnersRefreshed(
    2,
    map[string]struct{}{"alpha": {}},
  ) {
    t.Fatal("one producer completed a two-producer refresh")
  }
  if _, pending := proxy.pendingProjectDiagnosticOwners["alpha"]; pending {
    t.Fatal("successful producer remained pending")
  }
  if _, pending := proxy.pendingProjectDiagnosticOwners["beta"]; !pending {
    t.Fatal("failed producer was removed from pending scope")
  }
  if !proxy.recordPendingProjectDiagnosticOwnersRefreshed(
    2,
    map[string]struct{}{"beta": {}},
  ) {
    t.Fatal("separate producer successes did not complete the generation")
  }

  // A newer watched event can arrive after record reports completion but
  // before its caller clears the old generation. The newer scope must survive
  // that rejected completion unchanged.
  proxy.projectDiagnosticGeneration = 3
  proxy.pendingProjectDiagnosticGeneration = 3
  proxy.projectDiagnosticRefreshPending = true
  proxy.pendingProjectDiagnosticOwners = map[string]struct{}{"alpha": {}}
  proxy.completePendingProjectDiagnosticRefresh(2)
  proxy.projectRefreshMu.Lock()
  defer proxy.projectRefreshMu.Unlock()
  if !proxy.projectDiagnosticRefreshPending ||
    proxy.pendingProjectDiagnosticGeneration != 3 {
    t.Fatalf(
      "newer pending generation was cleared: pending %v, generation %d",
      proxy.projectDiagnosticRefreshPending,
      proxy.pendingProjectDiagnosticGeneration,
    )
  }
  if _, pending := proxy.pendingProjectDiagnosticOwners["alpha"]; !pending {
    t.Fatal("newer pending owner was cleared by the prior generation")
  }
}
