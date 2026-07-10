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

// TestServeSessionReloadsWhenProgramPluginLinked verifies a project with an
// active linked ProgramPlugin never takes the incremental source path.
//
// ProgramPlugin hooks mutate parsed ASTs in place and run exactly once per
// Program, so an incremental source replacement would leave the new AST
// without the plugin's mutations while the rest of the graph still carries
// them. A content-only edit must therefore rebuild through a full reload.
//
//  1. Register a linked ProgramPlugin and open a graph session.
//  2. Apply a content-only edit that would otherwise refresh incrementally.
//  3. Assert the snapshot reports a full reload with the post-edit node.
func TestServeSessionReloadsWhenProgramPluginLinked(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"probe","stage":"transform"}]`)
  driver.RegisterPlugin(serveProgramPluginProbe{})

  root := graphSessionFixture(t)
  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := session.Snapshot(); err != nil {
    t.Fatal(err)
  }

  file := filepath.Join(root, "src", "index.ts")
  if err := os.WriteFile(file, []byte("export class AfterEdit {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  dump, mode, changed, err := session.Snapshot()
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != "reload" || !changed || !hasDumpNode(*dump, "AfterEdit") {
    t.Fatalf("program-plugin edit = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
