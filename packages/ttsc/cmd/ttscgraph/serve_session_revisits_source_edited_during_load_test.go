package main

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestServeSessionRevisitsSourceEditedDuringLoad verifies a source edited
// between compiler load and state capture is refreshed on the next snapshot.
//
// Hashing the raw disk bytes at capture time would bless content the resident
// program never parsed: disk and graph would disagree until an unrelated
// change. Capture compares decoded disk text with resident text and marks a
// mismatch for revisiting, so the next snapshot applies the missed edit. This
// unit observes the resulting declarations and convergence, not hash values.
//
//  1. Load a session, then rewrite the source before capturing state.
//  2. Take a snapshot and assert it refreshes to the on-disk declaration.
//  3. Take another snapshot and assert the session has converged (unchanged).
//
// @evidence contracts/testing.md#behavioral-verification Verifies a source edited between compiler load and state capture is refreshed on the next snapshot.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: a source rewritten after the compiler loaded but before state capture must give a first snapshot that is changed and whose dump contains EditedDuringLoad and not BeforeEdit, followed by a second snapshot that is mode unchanged with no dump (converged). The first snapshot's mode is not asserted.
// @evidence contracts/testing.md#distinguishing-cases Load a session, then rewrite the source before capturing state; Take a snapshot and assert it refreshes to the on-disk declaration; Take another snapshot and assert the session has converged (unchanged).
// @evidence contracts/testing.md#execution-ownership TestServeSessionRevisitsSourceEditedDuringLoad is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionRevisitsSourceEditedDuringLoad(t *testing.T) {
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
  }
  defer session.Close()
  file := filepath.Join(root, "src", "index.ts")
  resident, ok := compiler.SourceText(file)
  if !ok || resident != "export class BeforeEdit {}\n" {
    t.Fatalf("resident source before disk edit = found:%v text:%q", ok, resident)
  }
  if err := os.WriteFile(file, []byte("export class EditedDuringLoad {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := session.captureState(); err != nil {
    t.Fatal(err)
  }

  dump, _, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || !changed || !hasDumpNode(*dump, "EditedDuringLoad") || hasDumpNode(*dump, "BeforeEdit") {
    t.Fatalf("edited-during-load source was not refreshed: dump:%v changed:%v", dump != nil, changed)
  }

  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != "unchanged" || changed {
    t.Fatalf("session did not converge after the missed edit: dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
