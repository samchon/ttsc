package driver_test

import (
  "crypto/sha256"
  "encoding/hex"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadFailureRetainsObservedRecoveryInputs verifies failed config/argument
// parsing transfers actual observations without acquiring a Program.
//
// A missing input can repair a failed load, so its absence cannot disappear
// merely because upstream rejected configuration before Program construction.
//
//  1. Fail a config extending a missing file after nested argument expansion.
//  2. Require observed absence and independently hashed argument reads.
//  3. Contrast failed argument expansion and a repaired successful load.
//
// @evidence contracts/testing.md#behavioral-verification Real LoadProgram invokes the recovery sink once on config and argument failures with no Program; actual response-file hashes and missing predicates survive, while a repaired successful Program owns its ordinary graph and invokes no failure sink.
// @evidence contracts/testing.md#independent-expectations Authored response text supplies independent SHA-256 expectations, literal missing config/argument names require false native file/read predicates, and a success must have zero callback invocations.
// @evidence contracts/testing.md#distinguishing-cases Nested response reads, missing extends config, missing nested argument file, nil Program, repaired success and both supported compiler targets distinguish failure metadata from completed source authority.
// @evidence contracts/testing.md#execution-ownership The Go driver runner discovers this direct API test; it owns one temporary project, its callback records and each acquired checker lease without launching another compiler or installing fixtures.
func TestLoadFailureRetainsObservedRecoveryInputs(t *testing.T) {
  root := t.TempDir()
  response := "--strict\n"
  writeProjectFile(t, root, "tsconfig.json", `{"extends":"./missing.json","files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")
  writeProjectFile(t, root, "main.rsp", "@nested.rsp\n")
  writeProjectFile(t, root, "nested.rsp", response)
  calls := 0
  var recovery *driver.TransformGraph
  options := driver.LoadProgramOptions{TsgoArgs: []string{"@main.rsp"}, OnFailureInputs: func(graph *driver.TransformGraph) { calls++; recovery = graph }}
  program, diags, err := driver.LoadProgram(root, "tsconfig.json", options)
  if err != nil || program != nil || driver.CountErrors(diags) == 0 || calls != 1 || recovery == nil {
    t.Fatalf("failed load: program=%v diagnostics=%#v error=%v calls=%d", program, diags, err, calls)
  }
  if len(recovery.Edges) != 0 || recovery.Membership != nil {
    t.Fatalf("failed load claimed a Program: %#v", recovery)
  }
  if !slices.Contains(recovery.ResolutionInputs, "missing.json") {
    t.Fatalf("missing config recovery path: %#v", recovery.ResolutionInputs)
  }
  absent := recovery.InputObservations["missing.json"]
  if absent.FileExists == nil || *absent.FileExists {
    t.Fatalf("missing config predicate: %#v", absent)
  }
  digest := sha256.Sum256([]byte(response))
  if hash := recovery.InputHashes["nested.rsp"]; hash == nil || *hash != hex.EncodeToString(digest[:]) {
    t.Fatalf("lost nested argument read: %#v", hash)
  }
  writeProjectFile(t, root, "main.rsp", "@absent.rsp\n")
  calls = 0
  program, diags, err = driver.LoadProgram(root, "tsconfig.json", options)
  if err != nil || program != nil || driver.CountErrors(diags) == 0 || calls != 1 || !slices.Contains(recovery.ResolutionInputs, "absent.rsp") {
    t.Fatalf("missing argument recovery: %v %#v calls=%d graph=%#v", err, diags, calls, recovery)
  }
  if read := recovery.InputObservations["absent.rsp"].ReadFile; read == nil || read.OK {
    t.Fatalf("missing argument read: %#v", read)
  }
  writeProjectFile(t, root, "main.rsp", "@nested.rsp\n")
  writeProjectFile(t, root, "missing.json", `{"compilerOptions":{"strict":true}}`)
  calls = 0
  program, diags, err = driver.LoadProgram(root, "tsconfig.json", options)
  if err != nil || program == nil || len(diags) != 0 || calls != 0 {
    t.Fatalf("repaired load: %v %#v calls=%d", err, diags, calls)
  }
  defer program.Close()
  if graph := driver.NewTransformGraph(program, root); !slices.Contains(graph.Configs, "missing.json") || !slices.Contains(graph.ResolutionInputs, "nested.rsp") {
    t.Fatalf("repaired inputs lost: %#v", graph)
  }
}
