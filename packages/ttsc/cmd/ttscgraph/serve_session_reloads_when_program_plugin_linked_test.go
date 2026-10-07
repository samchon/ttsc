package main

import (
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type serveProgramPluginProbe struct{}

func (serveProgramPluginProbe) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return nil
}

// TestServeSessionReloadsWhenProgramPluginLinked checks that one content rename
// reports reload when the manifest pairs with the registered no-op ProgramPlugin.
//
// ProgramPlugin implementations may mutate parsed ASTs, so the resident policy
// requires full reload for such a linked member. This no-op probe exercises
// classification and reported mode; it does not assert mutations, hook counts,
// AST identity or every possible edit.
//
//  1. Register a linked ProgramPlugin and open a graph session.
//  2. Apply a content-only edit that would otherwise refresh incrementally.
//  3. Assert the snapshot reports a full reload with the post-edit node.
//
// @evidence contracts/testing.md#behavioral-verification A registered no-op ProgramPlugin paired with the linked manifest makes the BeforeEdit-to-AfterEdit source rename report reload, changed and AfterEdit present. Mutation effects, hook invocation counts and compiler object identity are not asserted.
// @evidence contracts/testing.md#independent-expectations The resident policy requires reload when a linked member implements ProgramPlugin, because that capability permits AST mutation. Literal expected outcomes for this no-op implementation are reload, changed and AfterEdit; without that capability the same rename is incremental in the separate edit case. This does not certify actual mutation or once-per-Program dispatch.
// @evidence contracts/testing.md#distinguishing-cases Register a linked ProgramPlugin and open a graph session; Apply a content-only edit that would otherwise refresh incrementally; Assert the snapshot reports a full reload with the post-edit node.
// @evidence contracts/testing.md#execution-ownership This Go source-unit entry runs actual resident state/projection with explicit empty ignore membership. The manifest environment is restored by t.Setenv; RegisterPlugin retains its no-op registration for process lifetime, and the one-entry manifest selects registry index zero. No global registry reset is asserted. No consumer is installed or native artifact built or started. Real Git acquisition belongs to the separate worktree E2E.
func TestServeSessionReloadsWhenProgramPluginLinked(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"probe","stage":"transform"}]`)
  driver.RegisterPlugin(serveProgramPluginProbe{})

  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  file := filepath.Join(root, "src", "index.ts")
  if err := os.WriteFile(file, []byte("export class AfterEdit {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "AfterEdit") {
    t.Fatalf("program-plugin edit = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
