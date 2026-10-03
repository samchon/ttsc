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
//
// 1. Capture the initial program and use a relative project root to force projection failure.
// 2. Repair the root and retry the same resident change.
// 3. Require the first error to keep initialized change detection and an initial pending change, then publish the initial dump after repair.
//
// @evidence contracts/testing.md#behavioral-verification When the first dump fails (a relative project root is rejected as not absolute), the session still marks itself initialized and keeps an initial pending change, and after the root is repaired the same generation is published as an initial changed dump.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: the first snapshot must error with text containing 'project root', return no dump and changed false, leave initialized true and a pending change whose mode is initial, and after repairing the root return mode initial, changed, with a dump. The relative root is the deterministic failure injector.
// @evidence contracts/testing.md#distinguishing-cases Capture the initial program and use a relative project root to force projection failure. Repair the root and retry the same resident change. Require the first error to keep initialized change detection and an initial pending change, then publish the initial dump after repair.
// @evidence contracts/testing.md#execution-ownership TestServeSessionKeepsChangeDetectionLiveAfterInitialDumpError is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
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

  dump, _, changed, err := snapshotGraphState(session)
  if err == nil || !strings.Contains(err.Error(), "project root") {
    t.Fatalf("initial dump error = %v, want absolute-root rejection", err)
  }
  if dump != nil || changed || !session.initialized || session.pending == nil || session.pending.mode != serveModeInitial {
    t.Fatalf(
      "failed initial state = dump:%v changed:%v initialized:%v pending:%#v",
      dump != nil,
      changed,
      session.initialized,
      session.pending,
    )
  }

  session.cwd = root
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeInitial || !changed {
    t.Fatalf("repaired initial dump = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
