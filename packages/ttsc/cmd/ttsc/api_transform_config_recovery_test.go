package main

import (
  "encoding/json"
  "slices"
  "testing"
)

// TestAPITransformConfigFailureRetainsRecoveryInputs verifies the actual
// built-in transform command transports failed-load observations.
//
// Source output cannot carry repair inputs when config parsing creates no Program.
//
//  1. Run the actual API command on a missing extended config and response file.
//  2. Decode its native stdout envelope and retain the failure status.
//  3. Require missing config predicates and response reads without source output.
//
// @evidence contracts/testing.md#behavioral-verification Real runAPITransform consumes its ordinary argument preparation and loader, then serializes failed-load recovery metadata rather than dropping it with the nil Program.
// @evidence contracts/testing.md#independent-expectations Status 2, empty TypeScript, literal missing.json/main.rsp inputs and a false existence predicate define expected failure transport independently of command output.
// @evidence contracts/testing.md#distinguishing-cases A pre-Program config failure contrasts the existing semantic-error Program case; actual argv response expansion remains observable in the failure graph on both targets.
// @evidence contracts/testing.md#execution-ownership The command Go runner owns one temporary project and invocation-local captured streams; the actual command executes in process without a separate build or compiler subprocess.
func TestAPITransformConfigFailureRetainsRecoveryInputs(t *testing.T) {
  root := t.TempDir()
  writeCommandProjectFile(t, root, "tsconfig.json", `{"extends":"./missing.json","files":["main.ts"]}`)
  writeCommandProjectFile(t, root, "main.ts", "export const value = 1;\n")
  writeCommandProjectFile(t, root, "main.rsp", "--strict\n")
  code, output, stderr := captureCommand(t, func() int {
    return runAPITransform([]string{"--cwd", root, "--tsconfig", "tsconfig.json", "--tsgo-args", `["@main.rsp"]`})
  })
  var result apiTransformResult
  if err := json.Unmarshal([]byte(output), &result); err != nil {
    t.Fatalf("response decode: %v stdout=%s stderr=%s", err, output, stderr)
  }
  if code != 2 || len(result.TypeScript) != 0 || result.Graph == nil || !slices.Contains(result.Graph.ResolutionInputs, "missing.json") || !slices.Contains(result.Graph.ResolutionInputs, "main.rsp") {
    t.Fatalf("lost config recovery metadata: code=%d output=%s stderr=%s", code, output, stderr)
  }
  if result.ObservationsComplete == nil || *result.ObservationsComplete {
    t.Fatalf("failed load claimed complete observations: %s", output)
  }
  absent := result.Graph.InputObservations["missing.json"].FileExists
  if absent == nil || *absent {
    t.Fatalf("lost config absence predicate: %s", output)
  }
}
