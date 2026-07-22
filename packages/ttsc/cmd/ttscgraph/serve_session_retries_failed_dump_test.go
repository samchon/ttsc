package main

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestServeSessionKeepsChangeDetectionLiveAfterInitialDumpError verifies a
// rejected first dump still advances the session into its change-detection
// state. The invalid relative cwd is a deterministic path-mapper failure; once
// corrected, the same captured generation is retried and can become the first
// published snapshot.
func TestServeSessionKeepsChangeDetectionLiveAfterInitialDumpError(t *testing.T) {
  root := graphSessionFixture(t)
  compiler, diags, err := driver.NewSession(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if compiler == nil {
    t.Fatalf("NewSession returned nil session (diagnostics: %v)", diags)
  }
  session := &graphSession{
    cwd:      root,
    tsconfig: "tsconfig.json",
    compiler: compiler,
  }
  defer session.Close()
  if err := session.captureState(); err != nil {
    t.Fatal(err)
  }
  session.cwd = "relative-project"

  dump, _, changed, err := session.Snapshot()
  if err == nil || !strings.Contains(err.Error(), "project root") {
    t.Fatalf("initial dump error = %v, want absolute-root rejection", err)
  }
  if dump != nil || changed || !session.initialized || session.pendingDumpMode != serveModeInitial {
    t.Fatalf(
      "failed initial state = dump:%v changed:%v initialized:%v pending:%q",
      dump != nil,
      changed,
      session.initialized,
      session.pendingDumpMode,
    )
  }

  session.cwd = root
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeInitial || !changed {
    t.Fatalf("repaired initial dump = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}

// TestServeSessionRetriesAPendingDumpBeforeUnchanged pins the state boundary
// introduced by dump-time path validation. A failed dump may occur after the
// compiler generation and its hashes were captured; the next request must
// retry that generation instead of confirming the older client graph as
// unchanged.
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
    cwd:             root,
    tsconfig:        "tsconfig.json",
    compiler:        compiler,
    initialized:     true,
    pendingDumpMode: serveModeReload,
  }
  defer session.Close()
  if err := session.captureState(); err != nil {
    t.Fatal(err)
  }

  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed {
    t.Fatalf("pending dump retry = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
  if session.pendingDumpMode != "" {
    t.Fatalf("successful retry left pending mode %q", session.pendingDumpMode)
  }

  dump, mode, changed, err = session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("retry did not converge: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
