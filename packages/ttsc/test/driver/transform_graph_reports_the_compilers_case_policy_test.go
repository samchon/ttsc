package driver_test

import (
  "encoding/json"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTransformGraphReportsTheCompilersCasePolicy verifies the transform graph
// carries the case policy the compiler matched the project with.
//
// TypeScript-Go decides whether file names compare case-sensitively from the
// filesystem its executable lives on, not from the platform. A host deciding
// the same project membership guessed the policy from the platform instead,
// so on a case-sensitive macOS volume or a case-insensitive Linux one the two
// disagreed (samchon/ttsc#1545). The graph now reports the compiler's answer,
// false included.
//
//  1. Load a one-file project and compute its transform graph.
//  2. Assert the graph's policy is the program's, false on Windows.
//  3. Assert the encoded graph carries the field even when it is false.
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
}
