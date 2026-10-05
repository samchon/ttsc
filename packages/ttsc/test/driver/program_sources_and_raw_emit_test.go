package driver_test

import (
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "os"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverProgramSourcesAndRawEmit verifies source text, in-memory output and
// native graph facts over one compatible compiler Program. Declaration-only
// inputs contribute graph/global facts but remain outside SourceFiles.
//
//  1. Load the original index/declaration pair together with the API baseline
//     helper/model/isolated DAG and type/triple-slash/ambient graph inputs.
//  2. Record one raw emit, require JS/declaration and both maps for every source,
//     and prove the callback wrote no project output directory.
//  3. Check exact source bytes, graph edges/leaves/config/globals/content hashes
//     and forwarding of the actual compiler case-policy boolean.
//
// @evidence contracts/testing.md#behavioral-verification One LoadProgram provides SourceFile/SourceFiles text, EmitAllRaw output and NewTransformGraph facts. The writer stores actual JS/declaration/map strings only in memory, and bin/dist remain absent. The original exports.value output and baseline api-ok/upper declarations remain observable alongside exact source and graph membership.
// @evidence contracts/testing.md#independent-expectations Authored complete source strings, literal source/output paths, authored imports and independent SHA-256 fix expected text, population, edges, hashes and map presence. Native case-policy equality authenticates forwarding and JSON boolean presence, not an independently proved filesystem case rule.
// @evidence contracts/testing.md#distinguishing-cases Declaration-only versus emitted source, runtime versus type-only/triple-slash reference, module versus ambient global, connected versus empty leaf and memory versus absent disk outputs differ within the same population. Direct output-key inputs distinguish in-root ..src/..dist names from an actual parent escape without claiming those paths were emitted. This does not certify public API envelopes/completeness DTOs, incompatible decorator modes, error recovery, plugin host, worker/cache behavior or installed consumers.
// @evidence contracts/testing.md#execution-ownership The discoverable existing Go unit constructs one library Program in-process over an owned temporary project. It restores an empty linked-plugin manifest, supplies explicit empty forwarded flags, uses one recording raw writer and closes the Program. There is no child, CLI, native binary build, consumer installation or per-original Program loop.
func TestDriverProgramSourcesAndRawEmit(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  for _, name := range []string{"..src/main.ts", "..dist/main.js"} {
    if key := driver.TransformOutputKey(root, filepath.Join(root, filepath.FromSlash(name))); key != name {
      t.Errorf("dotted in-root output key = %q, want %q", key, name)
    }
  }
  outside := filepath.Join(filepath.Dir(root), "outside", "main.ts")
  if key := driver.TransformOutputKey(root, outside); key != filepath.ToSlash(outside) {
    t.Errorf("outside output key = %q, want absolute %q", key, filepath.ToSlash(outside))
  }
  sources := map[string]string{
    "index.ts":            "export const value = 1;\n",
    "src/main.ts":         "import type { Model } from \"./nested/model\";\nimport { helper } from \"./helpers\";\n\nconst message: string = \"api-ok\";\nconsole.log(message);\nexport const upper: string = helper(message);\nexport const model = { value: message } satisfies Model;\n",
    "src/helpers.ts":      "export const helper = (value: string): string => value.toUpperCase();\n",
    "src/nested/model.ts": "export interface Model { value: string }\n",
    "src/isolated.ts":     "export const isolated: number = 2;\n",
    "graph-entry.ts":      "/// <reference path=\"./ref.d.ts\" />\nimport type { MyType } from \"./mytype\";\nexport const graphValue: MyType = { id: \"x\" };\n",
    "mytype.ts":           "export interface MyType { id: string }\n",
  }
  declarations := map[string]string{
    "types.d.ts":   "export interface Named { name: string }\n",
    "ambient.d.ts": "declare const GLOBAL_FLAG: number;\n",
    "ref.d.ts":     "declare interface Referenced { flag: boolean }\n",
  }
  names := make([]string, 0, len(sources)+len(declarations))
  for name, text := range sources {
    writeProjectFile(t, root, name, text)
    names = append(names, name)
  }
  for name, text := range declarations {
    writeProjectFile(t, root, name, text)
    names = append(names, name)
  }
  slices.Sort(names)
  writeProjectFile(t, root, "tsconfig.base.json", `{"compilerOptions":{"strict":true}}`)
  config, err := json.Marshal(map[string]any{
    "extends":         "./tsconfig.base.json",
    "compilerOptions": map[string]any{"module": "commonjs", "target": "es2022", "rootDir": ".", "outDir": "bin", "declaration": true, "declarationMap": true, "sourceMap": true},
    "files":           names,
  })
  if err != nil {
    t.Fatal(err)
  }
  writeProjectFile(t, root, "tsconfig.json", string(config))
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: []string{}})
  if err != nil {
    t.Fatal(err)
  }
  if prog == nil || len(diags) != 0 {
    t.Fatalf("Program/configuration: %v, %#v", prog, diags)
  }
  defer prog.Close()
  if diags := prog.Diagnostics(); len(diags) != 0 {
    t.Fatalf("program diagnostics: %#v", diags)
  }
  found := make([]string, 0, len(sources))
  for _, source := range prog.SourceFiles() {
    name, err := filepath.Rel(root, source.FileName())
    if err != nil {
      t.Fatal(err)
    }
    key := filepath.ToSlash(name)
    expected, ok := sources[key]
    if !ok {
      t.Errorf("unexpected non-declaration source: %s", key)
      continue
    }
    if source.Text() != expected {
      t.Errorf("source bytes differ: %s", key)
    }
    if prog.SourceFile(filepath.Join(root, filepath.FromSlash(key))) != source {
      t.Errorf("SourceFile identity differs: %s", key)
    }
    found = append(found, key)
  }
  wantSources := make([]string, 0, len(sources))
  for name := range sources {
    wantSources = append(wantSources, name)
  }
  slices.Sort(wantSources)
  slices.Sort(found)
  if !slices.Equal(found, wantSources) {
    t.Errorf("source population = %v, want %v", found, wantSources)
  }
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    name, err := filepath.Rel(root, fileName)
    if err != nil {
      return err
    }
    emitted[filepath.ToSlash(name)] = text
    return nil
  })
  if err != nil || len(emitDiags) != 0 {
    t.Fatalf("emit: %v, %#v", err, emitDiags)
  }
  if len(emitted) != len(sources)*4 {
    t.Errorf("output population = %d, want %d", len(emitted), len(sources)*4)
  }
  for _, name := range wantSources {
    base := "bin/" + strings.TrimSuffix(name, ".ts")
    for _, suffix := range []string{".js", ".d.ts", ".js.map", ".d.ts.map"} {
      output, ok := emitted[base+suffix]
      if !ok || output == "" {
        t.Errorf("required nonempty memory output absent: %s", base+suffix)
      }
      if strings.HasSuffix(suffix, ".map") && !json.Valid([]byte(output)) {
        t.Errorf("invalid source map: %s", base+suffix)
      }
    }
  }
  if !strings.Contains(emitted["bin/index.js"], "exports.value") {
    t.Error("original raw exports.value output absent")
  }
  if !strings.Contains(emitted["bin/src/main.js"], "api-ok") || !strings.Contains(emitted["bin/src/main.d.ts"], "upper: string") {
    t.Error("baseline JS/declaration literals absent")
  }
  for _, name := range []string{"bin", "dist"} {
    if _, err := os.Lstat(filepath.Join(root, name)); !os.IsNotExist(err) {
      t.Errorf("memory-only emit left %s on disk: %v", name, err)
    }
  }
  graph := driver.NewTransformGraph(prog, root)
  if graph == nil {
    t.Fatal("NewTransformGraph returned nil")
  }
  for source, expected := range map[string][]string{
    "src/main.ts":     {"src/helpers.ts", "src/nested/model.ts"},
    "graph-entry.ts":  {"mytype.ts", "ref.d.ts"},
    "src/isolated.ts": {}, "src/helpers.ts": {}, "src/nested/model.ts": {}, "mytype.ts": {}, "index.ts": {},
  } {
    edges, present := graph.Edges[source]
    sorted := append([]string{}, edges...)
    slices.Sort(sorted)
    if !present || !slices.Equal(sorted, expected) {
      t.Errorf("graph edges %s = %v (present %t), want %v", source, edges, present, expected)
    }
  }
  for _, name := range []string{"ambient.d.ts", "ref.d.ts"} {
    if !slices.Contains(graph.Globals, name) {
      t.Errorf("ambient global absent: %s", name)
    }
  }
  for _, name := range wantSources {
    if slices.Contains(graph.Globals, name) {
      t.Errorf("module incorrectly global: %s", name)
    }
  }
  configNames := make([]string, 0, len(graph.Configs))
  for _, name := range graph.Configs {
    if filepath.IsAbs(filepath.FromSlash(name)) {
      relative, err := filepath.Rel(root, filepath.FromSlash(name))
      if err != nil {
        t.Fatal(err)
      }
      name = filepath.ToSlash(relative)
    }
    configNames = append(configNames, name)
  }
  if !slices.Equal(configNames, []string{"tsconfig.json", "tsconfig.base.json"}) {
    t.Errorf("config chain = %v", configNames)
  }
  for name, text := range sources {
    digest := sha256.Sum256([]byte(text))
    if hash := graph.InputHashes[name]; hash == nil || *hash != hex.EncodeToString(digest[:]) {
      t.Errorf("native content proof differs: %s", name)
    }
  }
  if graph.UseCaseSensitiveFileNames != prog.TSProgram.UseCaseSensitiveFileNames() {
    t.Error("compiler case policy was not forwarded")
  }
  graphJSON, err := json.Marshal(graph)
  if err != nil {
    t.Fatal(err)
  }
  var fields map[string]json.RawMessage
  if err := json.Unmarshal(graphJSON, &fields); err != nil {
    t.Fatal(err)
  }
  raw, present := fields["useCaseSensitiveFileNames"]
  var encodedPolicy bool
  if !present || json.Unmarshal(raw, &encodedPolicy) != nil || encodedPolicy != graph.UseCaseSensitiveFileNames {
    t.Error("case-policy JSON boolean absent or different")
  }
  assertNoBundledEntries(t, graph)
}
