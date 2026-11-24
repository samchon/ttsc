package utility

import (
  "path/filepath"
  "testing"
)

// TestCheckServeReloadsWhenProgramPluginLinked verifies the utility host's
// resident check never reuses a Program while a linked ProgramPlugin lacks
// CheckProgram.
//
// Such a hook can only answer by mutating the parsed ASTs in place, so an
// edited cycle over a reused Program could check mutated source. The host must
// load a fresh Program for every request instead, as one-shot check does, even
// beside a plugin that does answer through CheckProgram.
//
//  1. Select the checking probe and the mutating probe by a two-entry manifest.
//  2. Run two cycles around a content edit of a known source.
//  3. Require two loads, no update and no reuse.
//
// @evidence contracts/testing.md#behavioral-verification Two real checkServeState cycles with a linked ProgramPlugin lacking CheckProgram must report two loads, zero updates and no reuse; a host that kept the Program would report one load and an update.
// @evidence contracts/testing.md#independent-expectations The residency rule (no reuse while any linked ProgramPlugin lacks CheckProgram) fixes the literal counts; both probes return nil, so diagnostics are not the subject.
// @evidence contracts/testing.md#distinguishing-cases Owns the mutating-hook case, also beside a checking plugin; TestCheckServeKeepsProgramForCheckingProgramPlugin owns a checking plugin alone, and TestCheckServeReusesProgramAndMatchesColdCheck reuse without linked plugins.
// @evidence contracts/testing.md#execution-ownership A Go unit in the utility package process; check_serve_probes_test.go registers the probes once at fixed positions.
func TestCheckServeReloadsWhenProgramPluginLinked(t *testing.T) {
  root := writeCheckServeProject(t, "export const value = 1;\n")
  source := filepath.Join(root, "src", "main.ts")
  base, ok := parseHostOptions(
    "check-serve",
    []string{
      "--cwd", root,
      "--plugins-json", `[{"name":"checking","stage":"transform"},{"name":"mutating","stage":"transform"}]`,
    },
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
