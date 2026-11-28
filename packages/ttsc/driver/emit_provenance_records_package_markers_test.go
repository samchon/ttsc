package driver

import (
  "os"
  "path/filepath"
  "reflect"
  "testing"
)

// TestEmitProvenanceRecordsPackageMarkers verifies the compiler-owned mapping
// from selected JSON project markers to their successfully emitted outputs.
//
// 1. Import the project markers and an ordinary JSON asset from a module.
// 2. Emit the module into a separate output directory using the real writer.
// 3. Require the script and project markers to have physical source owners.
//
// @evidence contracts/testing.md#behavioral-verification The native Program emits the authored inputs through the real default writer and provenance recorder.
// @evidence contracts/testing.md#independent-expectations The fixture names its expected destinations under outDir and independently resolves the authored source paths.
// @evidence contracts/testing.md#distinguishing-cases The compiler writes all JSON inputs. The three project markers and script appear in the output-to-source map, and the unrelated JSON asset stays outside it.
// @evidence contracts/testing.md#execution-ownership A private temporary tree holds all fixture files, and the in-process driver owns loading, emission and the completed snapshot.
func TestEmitProvenanceRecordsPackageMarkers(t *testing.T) {
  root := t.TempDir()
  source := filepath.Join(root, "src")
  output := filepath.Join(root, "dist")
  config := filepath.Join(root, "tsconfig.json")
  if err := os.Mkdir(source, 0700); err != nil {
    t.Fatal(err)
  }
  for file, text := range map[string]string{
    config: `{"compilerOptions":{"target":"esnext","module":"nodenext","resolveJsonModule":true,"rootDir":"src","outDir":"dist","types":[]},"files":["src/main.ts"]}`,
    filepath.Join(source, "main.ts"): `
import pkg from "./package.json" with { type: "json" };
import tsconfig from "./tsconfig.json" with { type: "json" };
import jsconfig from "./jsconfig.json" with { type: "json" };
import data from "./data.json" with { type: "json" };
export const value = [pkg, tsconfig, jsconfig, data];`,
    filepath.Join(source, "package.json"): `{"type":"module"}`,
    filepath.Join(source, "tsconfig.json"): `{"compilerOptions":{"strict":true}}`,
    filepath.Join(source, "jsconfig.json"): `{"compilerOptions":{"checkJs":true}}`,
    filepath.Join(source, "data.json"): `{"value":1}`,
  } {
    if err := os.WriteFile(file, []byte(text), 0600); err != nil {
      t.Fatal(err)
    }
  }
  program, diagnostics, err := LoadProgram(root, config, LoadProgramOptions{})
  if err != nil || program == nil || len(diagnostics) != 0 {
    t.Fatalf("load: %v %v", err, diagnostics)
  }
  defer program.Close()
  if diagnostics := program.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("check: %v", diagnostics)
  }
  writer, snapshot, err := program.NewEmitProvenanceRecorder(nil)
  if err != nil {
    t.Fatal(err)
  }
  if _, diagnostics, err := program.EmitAll(NewRewriteSet(), writer); err != nil || len(diagnostics) != 0 {
    t.Fatalf("emit: %v %v", err, diagnostics)
  }
  for _, file := range []string{"main.js", "package.json", "tsconfig.json", "jsconfig.json", "data.json"} {
    if _, err := os.Stat(filepath.Join(output, file)); err != nil {
      t.Fatal(err)
    }
  }
  expected := map[string][]string{}
  for out, input := range map[string]string{
    "main.js": "main.ts", "package.json": "package.json", "tsconfig.json": "tsconfig.json", "jsconfig.json": "jsconfig.json",
  } {
    physical, err := filepath.EvalSymlinks(filepath.Join(source, input))
    if err != nil {
      t.Fatal(err)
    }
    expected[filepath.Join(output, out)] = []string{physical}
  }
  if actual := snapshot(); !reflect.DeepEqual(actual, expected) {
    t.Fatalf("provenance = %v, want %v", actual, expected)
  }
}
