package driver

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// TestCompilationSnapshotPreservesCheckedEmission verifies consecutive compiler
// stages check and emit captured text after the physical source is edited.
// The next invocation must still reject the new ill-typed source.
//
// 1. Load and check an authored string assignment under a private snapshot.
// 2. Introduce an incompatible number, then load and emit the captured source.
// 3. Start a fresh snapshot and require the actual type error to be reported.
//
// @evidence contracts/testing.md#behavioral-verification Real driver loading, diagnostics, graph capture and emission share captured BEFORE text across two native Programs while a new invocation reports TS2322 for the changed disk source.
// @evidence contracts/testing.md#independent-expectations Authored string and number assignments define TypeScript assignability; literal BEFORE emission and diagnostic code 2322 do not come from implementation snapshots.
// @evidence contracts/testing.md#distinguishing-cases A same-invocation stage must preserve old successful emission while a new invocation must observe the adjacent type error; source graph identity and output provenance must remain populated.
// @evidence contracts/testing.md#execution-ownership This Go driver unit exercises linked compiler APIs in-process over private files, without a consumer installation, native build or spawned product host.
func TestCompilationSnapshotPreservesCheckedEmission(t *testing.T) {
  root := t.TempDir()
  source := filepath.Join(root, "source.ts")
  config := filepath.Join(root, "tsconfig.json")
  document := filepath.Join(t.TempDir(), "inputs.json")
  write := func(file, text string) {
    t.Helper()
    if err := os.WriteFile(file, []byte(text), 0600); err != nil {
      t.Fatal(err)
    }
  }
  fresh := func(id string) {
    write(document, `{"version":1,"id":"`+id+`","reads":{},"files":{},"directories":{},"entries":{},"realpaths":{},"stats":{}}`)
  }
  write(config, `{"compilerOptions":{"target":"es2020","module":"commonjs","types":[],"strict":true},"files":["source.ts"]}`)
  write(source, `export const value: string = "BEFORE";`)
  fresh("first")
  t.Setenv("TTSC_COMPILATION_SNAPSHOT", document)
  load := func() *Program {
    t.Helper()
    program, diagnostics, err := LoadProgram(root, config, LoadProgramOptions{})
    if err != nil || program == nil || len(diagnostics) != 0 {
      t.Fatalf("load: %v %v", err, diagnostics)
    }
    return program
  }
  first := load()
  if diagnostics := first.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("first check: %v", diagnostics)
  }
  if err := first.Close(); err != nil {
    t.Fatal(err)
  }
  write(source, `export const value: string = 123;`)
  second := load()
  defer second.Close()
  if diagnostics := second.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("captured check: %v", diagnostics)
  }
  graph := NewTransformGraph(second, root)
  if graph.CompilationSnapshot != "first" || len(graph.InputProofFailures) != 0 {
    t.Fatalf("graph lost captured authority: %+v", graph)
  }
  var emitted strings.Builder
  writer, provenance, err := second.NewEmitProvenanceRecorder(func(_ shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted.WriteString(text)
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if _, diagnostics, err := second.EmitAll(NewRewriteSet(), writer); err != nil || len(diagnostics) != 0 {
    t.Fatalf("emit: %v %v", err, diagnostics)
  }
  if !strings.Contains(emitted.String(), "BEFORE") || strings.Contains(emitted.String(), "123") {
    t.Fatalf("emitted another input: %s", emitted.String())
  }
  if len(provenance()) == 0 {
    t.Fatal("captured emission lost source ownership")
  }
  if err := second.Close(); err != nil {
    t.Fatal(err)
  }
  fresh("next")
  next := load()
  defer next.Close()
  found := false
  for _, diagnostic := range next.Diagnostics() {
    if diagnostic.Code == 2322 {
      found = true
    }
  }
  if !found {
    t.Fatal("new invocation did not report the edited source's TS2322")
  }
}
