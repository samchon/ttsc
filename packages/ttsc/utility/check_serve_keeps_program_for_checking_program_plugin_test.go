package utility

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCheckServeKeepsProgramForCheckingProgramPlugin verifies a linked
// ProgramPlugin that implements CheckProgram keeps the resident Program and
// still decides each cycle's outcome (#1864).
//
// CheckProgram promises ApplyProgram's analysis outcome without mutating the
// ASTs, which is what lets `@ttsc/paths` and `@ttsc/strip` stay resident. The
// host must call it on every cycle, never ApplyProgram.
//
//  1. Select the checking probe, whose ApplyProgram panics, by a one-entry
//     manifest.
//  2. Run a passing cycle, then an edited cycle with the probe failing.
//  3. Require one load with an incremental update, the probe's error and a
//     failing status on the second cycle.
//
// @evidence contracts/testing.md#behavioral-verification Real checkServeState cycles must reuse the Program (one load, one update) while reporting the probe's CheckProgram failure; a host that called ApplyProgram panics into a response without the probe's error text, and one that reloaded reports two loads.
// @evidence contracts/testing.md#independent-expectations The probe's own error text and the protocol's load/update counts are the oracle.
// @evidence contracts/testing.md#distinguishing-cases Owns a checking ProgramPlugin with a passing and a failing outcome; TestCheckServeReloadsWhenProgramPluginLinked owns a plugin without CheckProgram.
// @evidence contracts/testing.md#execution-ownership A Go unit in the utility package process; check_serve_probes_test.go registers the probes once at fixed positions.
func TestCheckServeKeepsProgramForCheckingProgramPlugin(t *testing.T) {
  checkServeCheckingFailure = false
  t.Cleanup(func() { checkServeCheckingFailure = false })
  root := writeCheckServeProject(t, "export const value = 1;\n")
  source := filepath.Join(root, "src", "main.ts")
  base, ok := parseHostOptions(
    "check-serve",
    []string{"--cwd", root, "--plugins-json", `[{"name":"checking","stage":"transform"}]`},
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
  if first.Status != 0 || first.Telemetry.ProgramLoads != 1 {
    t.Fatalf("first cycle = %#v", first)
  }
  checkServeCheckingFailure = true
  writeCheckServeFile(t, source, "export const value = 2;\n")
  second := serveCheckLine(t, state, checkServeRequest{Changed: []string{source}})
  if second.Status != 2 || !strings.Contains(second.Stderr, "probe: configured failure") ||
    second.Telemetry.ProgramLoads != 1 || second.Telemetry.ProgramUpdates != 1 ||
    !second.Telemetry.Reused {
    t.Fatalf("second cycle = %#v", second)
  }
}
