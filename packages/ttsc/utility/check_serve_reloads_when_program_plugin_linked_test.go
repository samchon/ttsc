package utility

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type checkServeProgramPluginProbe struct{}

func (checkServeProgramPluginProbe) ApplyProgram(*driver.Program, driver.PluginContext) error {
  return nil
}

// TestCheckServeReloadsWhenProgramPluginLinked verifies the utility host's
// resident check never reuses a Program once a linked ProgramPlugin is active.
//
// ProgramPlugin hooks may mutate the parsed ASTs in place, so an edited cycle
// over a reused Program could check mutated source. The host must load a fresh
// Program for every request instead, as one-shot check does.
//
//  1. Register a no-op ProgramPlugin and select it through the manifest.
//  2. Run two cycles around a content edit of a known source.
//  3. Require two loads, no update and no reuse.
//
// @evidence contracts/testing.md#behavioral-verification Two real checkServeState cycles with a linked ProgramPlugin must report two loads, zero updates and no reuse; a host that kept the Program would report one load and an update.
// @evidence contracts/testing.md#independent-expectations The residency rule (no reuse while a ProgramPlugin is linked) fixes the literal counts; the probe's hook does nothing, so diagnostics are not the subject.
// @evidence contracts/testing.md#distinguishing-cases Owns the AST-mutating hook case; TestCheckServeReusesProgramAndMatchesColdCheck owns reuse without linked plugins.
// @evidence contracts/testing.md#execution-ownership A Go unit in the utility package process; RegisterPlugin keeps the probe for the process lifetime at registry index zero, and only this test's manifest selects it.
func TestCheckServeReloadsWhenProgramPluginLinked(t *testing.T) {
  driver.RegisterPlugin(checkServeProgramPluginProbe{})
  root := writeCheckServeProject(t, "export const value = 1;\n")
  source := filepath.Join(root, "src", "main.ts")
  base, ok := parseHostOptions(
    "check-serve",
    []string{"--cwd", root, "--plugins-json", `[{"name":"probe","stage":"transform"}]`},
    nil,
    nil,
  )
  if !ok {
    t.Fatal("check-serve options rejected")
  }
  base.noEmit = true
  state := &checkServeState{base: base}
  defer state.close()

  first := serveCheckLine(t, state, checkServeRequest{})
  writeCheckServeFile(t, source, "export const value = 2;\n")
  second := serveCheckLine(t, state, checkServeRequest{Changed: []string{source}})
  if first.Status != 0 || second.Status != 0 ||
    second.Telemetry.ProgramLoads != 2 || second.Telemetry.ProgramUpdates != 0 ||
    second.Telemetry.Reused {
    t.Fatalf("program-plugin cycles = %#v then %#v", first, second)
  }
}
