package driver_test

import (
  "encoding/json"
  "fmt"
  "path/filepath"
  "reflect"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerEmitsDeclarationOutputs pins the complete output
// set for the plugin-transform emit lane.
//
// EmitWithPluginTransformers owns the transformed JavaScript path, but it must
// not narrow tsgo's output set to only `.js` and `.js.map`. A declaration build
// must still emit the same declaration artifacts as raw tsgo emit: `.d.ts` and
// `.d.ts.map`, including the declaration map trailer inside the `.d.ts`.
func TestEmitWithPluginTransformerEmitsDeclarationOutputs(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "sourceMap": true,
    "strict": true,
    "tsBuildInfoFile": "dist/index.tsbuildinfo"
  },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "src/index.ts", strings.Join([]string{
    "export interface Payload {",
    "  readonly label: string;",
    "}",
    "export const value: number = 1;",
    "",
  }, "\n"))

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  raw := map[string]string{}
  if _, emitDiags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    raw[filepath.Base(fileName)] = text
    return nil
  }); err != nil || len(emitDiags) != 0 {
    t.Fatalf("raw emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "1" {
        return ec.Factory.NewNumericLiteral("2", 0)
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
  }

  plugin := map[string]string{}
  if emitDiags, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    plugin[filepath.Base(fileName)] = text
    return nil
  }); err != nil || len(emitDiags) != 0 {
    t.Fatalf("plugin emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  if got, want := sortedStringKeys(plugin), sortedStringKeys(raw); !reflect.DeepEqual(got, want) {
    t.Fatalf("plugin emit output set mismatch:\n  got  %v\n  want %v", got, want)
  }
  for _, name := range []string{"index.js", "index.js.map", "index.d.ts", "index.d.ts.map"} {
    if plugin[name] == "" {
      t.Fatalf("%s was not emitted; got keys %v", name, sortedStringKeys(plugin))
    }
  }
  if !strings.Contains(plugin["index.js"], "exports.value = 2;") {
    t.Fatalf("plugin transform did not affect JavaScript:\n%s", plugin["index.js"])
  }
  if plugin["index.d.ts"] != raw["index.d.ts"] {
    t.Fatalf("declaration output diverged from raw tsgo emit:\nplugin:\n%s\nraw:\n%s", plugin["index.d.ts"], raw["index.d.ts"])
  }
  if plugin["index.d.ts.map"] != raw["index.d.ts.map"] {
    t.Fatalf("declaration map output diverged from raw tsgo emit:\nplugin:\n%s\nraw:\n%s", plugin["index.d.ts.map"], raw["index.d.ts.map"])
  }
  if !strings.Contains(plugin["index.d.ts"], "//# sourceMappingURL=index.d.ts.map") {
    t.Fatalf("declaration output missing declaration map trailer:\n%s", plugin["index.d.ts"])
  }

  var parsed struct {
    Version  int      `json:"version"`
    Sources  []string `json:"sources"`
    Mappings string   `json:"mappings"`
  }
  if err := json.Unmarshal([]byte(plugin["index.d.ts.map"]), &parsed); err != nil {
    t.Fatalf("index.d.ts.map is not valid JSON: %v\n%s", err, plugin["index.d.ts.map"])
  }
  if parsed.Version != 3 || parsed.Mappings == "" {
    t.Fatalf("index.d.ts.map is not a populated v3 source map: %#v", parsed)
  }
  foundSource := false
  for _, source := range parsed.Sources {
    if strings.HasSuffix(filepath.ToSlash(source), "src/index.ts") {
      foundSource = true
    }
  }
  if !foundSource {
    t.Fatalf("declaration map sources do not reference src/index.ts: %v", parsed.Sources)
  }
}

// TestEmitWithPluginTransformerEmitDeclarationOnlyOutputs covers the
// declaration-only branch: the plugin-transform lane has no JavaScript output to
// own, but it must still pass through the declaration outputs TypeScript-Go
// would have emitted.
func TestEmitWithPluginTransformerEmitDeclarationOnlyOutputs(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "strict": true
  },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "src/index.ts", strings.Join([]string{
    "export interface Payload {",
    "  readonly label: string;",
    "}",
    "export declare const payload: Payload;",
    "",
  }, "\n"))

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  raw := map[string]string{}
  if _, emitDiags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    raw[filepath.Base(fileName)] = text
    return nil
  }); err != nil || len(emitDiags) != 0 {
    t.Fatalf("raw emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  transformCalled := false
  plugin := map[string]string{}
  transform := func(_ *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    transformCalled = true
    return sf
  }
  if emitDiags, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    plugin[filepath.Base(fileName)] = text
    return nil
  }); err != nil || len(emitDiags) != 0 {
    t.Fatalf("plugin emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  if transformCalled {
    t.Fatal("JavaScript transform ran during emitDeclarationOnly")
  }
  if got, want := sortedStringKeys(plugin), sortedStringKeys(raw); !reflect.DeepEqual(got, want) {
    t.Fatalf("plugin emit output set mismatch:\n  got  %v\n  want %v", got, want)
  }
  if _, ok := plugin["index.js"]; ok {
    t.Fatalf("emitDeclarationOnly unexpectedly emitted JavaScript: %v", sortedStringKeys(plugin))
  }
  for _, name := range []string{"index.d.ts", "index.d.ts.map"} {
    if plugin[name] == "" {
      t.Fatalf("%s was not emitted; got keys %v", name, sortedStringKeys(plugin))
    }
  }
}

// TestEmitWithPluginTransformerDeclarationWriteCallbackSerialized locks the
// declaration-lane WriteFile callback contract for plugin-transform emit.
//
// TypeScript-Go emits one source file per goroutine. The JavaScript side of
// EmitWithPluginTransformers is hand-assembled and serial, but the delegated dts
// emit is still parallel. A plugin writer may be a plain output map, so ttsc
// must serialize that callback just like EmitAllRaw does.
func TestEmitWithPluginTransformerDeclarationWriteCallbackSerialized(t *testing.T) {
  root := t.TempDir()

  const sources = 24
  names := make([]string, sources)
  for i := range names {
    names[i] = fmt.Sprintf("mod%02d", i)
  }
  writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "dist",
    "declaration": true,
    "emitDeclarationOnly": true,
    "strict": true
  },
  "files": [%s]
}
`, `"`+strings.Join(filesList(names), `", "`)+`"`))
  for _, name := range names {
    writeProjectFile(t, root, name+".ts", fmt.Sprintf("export const value = %q;\n", name))
  }

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  const iterations = 100
  for iter := 0; iter < iterations; iter++ {
    emitted := map[string]int{}
    emitDiags, err := prog.EmitWithPluginTransformers(nil, func(fileName, _ string, _ *shimcompiler.WriteFileData) error {
      _ = len(emitted)
      emitted[filepath.Base(fileName)]++
      return nil
    })
    if err != nil {
      t.Fatalf("iteration %d: %v", iter, err)
    }
    if len(emitDiags) != 0 {
      t.Fatalf("iteration %d: unexpected emit diagnostics: %#v", iter, emitDiags)
    }
    if len(emitted) != len(names) {
      t.Fatalf("iteration %d: expected %d declaration outputs, got %d: %#v", iter, len(names), len(emitted), emitted)
    }
    for _, name := range names {
      if count := emitted[name+".d.ts"]; count != 1 {
        t.Fatalf("iteration %d: %s.d.ts written %d times", iter, name, count)
      }
    }
  }
}

// TestEmitPluginTransformersDeclarationDirOutputsSurviveOutDirContainment pins
// the declarationDir branch for the plugin-transform emit lane.
//
// The JS output for a dependency source may be skipped by the forced-emit
// outDir guard, but that decision must be per emitted path. A legitimate
// project declaration written under declarationDir must still survive.
func TestEmitPluginTransformersDeclarationDirOutputsSurviveOutDirContainment(t *testing.T) {
  root := t.TempDir()
  project := writeSelfReferencedDependencyProject(t, root)
  writeProjectFile(t, root, "proj/tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "declarationDir": "types",
    "sourceMap": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`)
  prog, diags, err := driver.LoadProgram(project, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  written := map[string]bool{}
  emitDiags, err := prog.EmitWithPluginTransformers(nil, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    written[filepath.ToSlash(fileName)] = true
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }

  outDir := filepath.ToSlash(filepath.Join(project, "dist")) + "/"
  declarationDir := filepath.ToSlash(filepath.Join(project, "types")) + "/"
  saw := map[string]bool{}
  for file := range written {
    if !strings.HasPrefix(file, outDir) && !strings.HasPrefix(file, declarationDir) {
      t.Fatalf("emit escaped outDir and declarationDir: %s (all writes: %v)", file, sortedBoolKeys(written))
    }
    switch {
    case strings.HasSuffix(file, "/main.js"):
      saw["main.js"] = true
    case strings.HasSuffix(file, "/main.js.map"):
      saw["main.js.map"] = true
    case strings.HasSuffix(file, "/main.d.ts"):
      saw["main.d.ts"] = true
    case strings.HasSuffix(file, "/main.d.ts.map"):
      saw["main.d.ts.map"] = true
    }
  }
  for _, name := range []string{"main.js", "main.js.map", "main.d.ts", "main.d.ts.map"} {
    if !saw[name] {
      t.Fatalf("%s was not emitted; wrote %v", name, sortedBoolKeys(written))
    }
  }
}

func sortedStringKeys(m map[string]string) []string {
  out := make([]string, 0, len(m))
  for key := range m {
    out = append(out, key)
  }
  sort.Strings(out)
  return out
}

func sortedBoolKeys(m map[string]bool) []string {
  out := make([]string, 0, len(m))
  for key := range m {
    out = append(out, key)
  }
  sort.Strings(out)
  return out
}
