package lspserver

import "testing"

// TestProjectDiagnosticsRefreshAccumulatesOwnerFreshness verifies separately
// reported owner successes can jointly satisfy one pending generation. It does
// not execute the producers that supply those success reports.
//
// @evidence contracts/testing.md#behavioral-verification A stale supplied success leaves beta pending; current alpha success leaves beta pending, and current beta success reports completion. An older completion request cannot clear a manually installed newer pending generation or its alpha owner.
// @evidence contracts/testing.md#independent-expectations Authored generation numbers, alpha/beta membership and literal completion booleans are independent of the actual state-transition helpers. Supplied success sets are inputs, not observations of successful native producers.
// @evidence contracts/testing.md#distinguishing-cases Stale versus current success, partial versus accumulated completion, and older completion against newer pending state are observed sequentially. Actual concurrent watched events, all-owner mode and the caller's publication are not exercised.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit calls the actual Proxy state-transition methods in-process on owned Proxy fields. It uses no substituted operation, native child, temporary project, installed consumer or product host; the newer state is authored directly rather than delivered by a watcher.
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
