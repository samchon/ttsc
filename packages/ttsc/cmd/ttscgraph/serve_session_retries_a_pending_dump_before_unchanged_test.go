package main

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestServeSessionRetriesAPendingDumpBeforeUnchanged pins the state boundary
// introduced by dump-time path validation. A failed dump may occur after the
// compiler generation and its hashes were captured; the next request must
// retry that generation instead of confirming the older client graph as
// unchanged.
//
// 1. Capture a loaded program with an explicit pending reload change.
// 2. Request two snapshots without another disk edit.
// 3. Require the first request to publish reload and clear pending state, then the second to return unchanged with no dump.
//
// @evidence contracts/testing.md#behavioral-verification A session holding a pending full reload change publishes that retry on the next snapshot, clears the pending state, and only then reports unchanged with no dump on a further snapshot with no disk edit.
// @evidence contracts/testing.md#independent-expectations The expectations are literal states: with pending set to a reload change and no disk change, the first snapshot must be mode reload, changed, with a dump and leave pending nil, and the second must be mode unchanged with no dump. A session that ignored pending would answer unchanged first.
// @evidence contracts/testing.md#distinguishing-cases Capture a loaded program with an explicit pending reload change. Request two snapshots without another disk edit. Require the first request to publish reload and clear pending state, then the second to return unchanged with no dump.
// @evidence contracts/testing.md#execution-ownership TestServeSessionRetriesAPendingDumpBeforeUnchanged is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionRetriesAPendingDumpBeforeUnchanged(t *testing.T) {
  root := graphSessionFixture(t)
  compiler, diags, err := driver.NewSession(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if compiler == nil {
    t.Fatalf("NewSession returned nil session (diagnostics: %v)", diags)
  }
  session := &graphSession{
    cwd:         root,
    tsconfig:    "tsconfig.json",
    compiler:    compiler,
    initialized: true,
    pending:     &graphChange{mode: serveModeReload, full: true},
  }
  defer session.Close()
  if err := session.captureState(); err != nil {
    t.Fatal(err)
  }

  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed {
    t.Fatalf("pending dump retry = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
  if session.pending != nil {
    t.Fatalf("successful retry left pending change %#v", session.pending)
  }

  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("retry did not converge: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
