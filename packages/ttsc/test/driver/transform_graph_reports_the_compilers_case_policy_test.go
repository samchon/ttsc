package driver_test

import (
  "encoding/json"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTransformGraphReportsTheCompilersCasePolicy Verifies that NewTransformGraph forwards the Program's case policy and JSON retains its field even when false.
//
// The live policy and field presence are asserted; alternate-volume capabilities are not manufactured.
//
// 1. Load a one-file project and compute its transform graph.
// 2. Assert the graph's policy is the program's, false on Windows.
// 3. Assert the encoded graph carries the field even when it is false.
//
// @evidence contracts/testing.md#behavioral-verification NewTransformGraph forwards the Program's case policy and JSON retains its field even when false.
// @evidence contracts/testing.md#independent-expectations TSProgram supplies the compiler policy for the adapter; Windows false is independently checked, while other platforms' volume policies are not independently probed.
// @evidence contracts/testing.md#distinguishing-cases The live policy and field presence are asserted; alternate-volume capabilities are not manufactured.
// @evidence contracts/testing.md#execution-ownership The Go entry loads a Program, builds and marshals its graph, and closes it. Go discovers TestTransformGraphReportsTheCompilersCasePolicy under ./test/driver.
func TestTransformGraphReportsTheCompilersCasePolicy(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"files": ["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "export const value = true;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    ForceNoEmit: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  graph := driver.NewTransformGraph(prog, root)
  if graph == nil {
    t.Fatal("NewTransformGraph returned nil for a loaded program")
  }
  if graph.UseCaseSensitiveFileNames != prog.TSProgram.UseCaseSensitiveFileNames() {
    t.Fatalf("graph policy %t, program policy %t", graph.UseCaseSensitiveFileNames, prog.TSProgram.UseCaseSensitiveFileNames())
  }
  if runtime.GOOS == "windows" && graph.UseCaseSensitiveFileNames {
    t.Fatal("TypeScript-Go compares case-insensitively on Windows")
  }

  encoded, err := json.Marshal(graph)
  if err != nil {
    t.Fatal(err)
  }
  var fields map[string]json.RawMessage
  if err := json.Unmarshal(encoded, &fields); err != nil {
    t.Fatal(err)
  }
  if _, ok := fields["useCaseSensitiveFileNames"]; !ok {
    t.Fatalf("the encoded graph omits its case policy: %s", encoded)
  }
  var encodedPolicy bool
  if err := json.Unmarshal(fields["useCaseSensitiveFileNames"], &encodedPolicy); err != nil {
    t.Fatal(err)
  }
  if encodedPolicy != graph.UseCaseSensitiveFileNames {
    t.Fatalf("encoded policy %t, graph policy %t", encodedPolicy, graph.UseCaseSensitiveFileNames)
  }
}
