package driver_test

import (
  "maps"
  "os"
  "path/filepath"
  "slices"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// readFileForTest returns one fixture artifact as text.
func readFileForTest(t *testing.T, path string) string {
  t.Helper()
  contents, err := os.ReadFile(path)
  if err != nil {
    t.Fatal(err)
  }
  return string(contents)
}

// writeProjectFile materializes one project-shaped fixture file. The tests in
// this package intentionally build real tsconfig projects instead of mocking
// compiler internals, so each scenario owns its whole temporary project tree.
func writeProjectFile(t *testing.T, root, name, contents string) {
  t.Helper()
  file := filepath.Join(root, filepath.FromSlash(name))
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
    t.Fatal(err)
  }
}

// utf8BOM is the byte order mark `emitBOM` prepends, the same three bytes
// tsgo's stringutil.AddUTF8ByteOrderMark writes. Shared: the emit lanes'
// parity, WriteFileData, and source-preamble cases all witness it.
const utf8BOM = "\ufeff"

// emittedArtifact is one WriteFile callback invocation: the artifact's text and
// the WriteFileData the emit lane handed the callback alongside it, copied so a
// later write cannot mutate what an earlier one reported. data is nil when the
// lane passed none — which is what tsgo's emitter does for the external source
// map, and what the plugin lane must therefore do too.
type emittedArtifact struct {
  text string
  data *shimcompiler.WriteFileData
}

// emitFixtureArtifacts compiles the project at root and returns its emitted
// artifacts by base name, through the plain tsgo emit (EmitAllRaw) or through
// the hand-assembled plugin-transform lane (EmitLinkedTransforms, no
// transforms). The plain lane is the oracle every plugin-lane assertion is
// compared against. Each call builds its own Program so the two lanes never
// observe each other's per-node emit state.
func emitFixtureArtifacts(t *testing.T, root string, viaPluginLane bool) map[string]emittedArtifact {
  t.Helper()
  resetLinkedPluginRegistry()
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  emitted := map[string]emittedArtifact{}
  write := func(fileName shimtspath.RootedFilePath, text string, data *shimcompiler.WriteFileData) error {
    artifact := emittedArtifact{text: text}
    if data != nil {
      copied := *data
      artifact.data = &copied
    }
    emitted[filepath.Base(fileName.AsString())] = artifact
    return nil
  }
  if viaPluginLane {
    emitDiags, err := prog.EmitLinkedTransforms(write)
    if err != nil {
      t.Fatal(err)
    }
    if len(emitDiags) != 0 {
      t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
    }
    return emitted
  }
  _, emitDiags, err := prog.EmitAllRaw(write)
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  return emitted
}

// sortedKeys returns a map's keys in a deterministic order for comparison and
// failure messages.
func sortedKeys[V any](m map[string]V) []string {
  return slices.Sorted(maps.Keys(m))
}

// emitIndexWithRewrite compiles one index.ts fixture and returns its emitted
// JavaScript after the supplied rewrite is registered against the parsed source.
func emitIndexWithRewrite(t *testing.T, sourceText string, rewrite driver.Rewrite) string {
  t.Helper()
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", sourceText)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  source := prog.SourceFile(filepath.Join(root, "index.ts"))
  if source == nil {
    t.Fatal("SourceFile did not find index.ts")
  }
  rewrite.File = source
  rewrites := driver.NewRewriteSet()
  rewrites.Add(rewrite)
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAll(rewrites, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  js := emitted["index.js"]
  if js == "" {
    t.Fatalf("index.js was not emitted: %#v", emitted)
  }
  return js
}
