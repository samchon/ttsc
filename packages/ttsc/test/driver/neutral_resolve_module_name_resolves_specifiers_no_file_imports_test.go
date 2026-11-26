package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestNeutralResolveModuleNameResolvesSpecifiersNoFileImports Verifies the
// version-neutral ResolveModuleName and SourceFileForResolvedModule helpers
// resolve specifiers no file of the Program imported, on both compiler targets.
//
// A plugin can need the target of a specifier no file wrote, such as a package
// its transform introduces or a specifier the checker printed. The Program's
// cached resolutions hold only what its files wrote.
//
// 1. Load a NodeNext project whose index.ts imports nothing alongside a loaded
// sibling, an unloaded sibling, a node_modules package and a paths mapping.
// 2. Resolve each specifier from index.ts through shimcompiler.ResolveModuleName
// and look up its source file through shimcompiler.SourceFileForResolvedModule.
// 3. Assert resolution status, resolved filename and Program membership for
// loaded, unloaded, package, paths-mapped and absent specifiers.
//
// @evidence contracts/testing.md#behavioral-verification Loads a real Program via driver.LoadProgram and exercises shimcompiler.ResolveModuleName and shimcompiler.SourceFileForResolvedModule against real temporary project files, asserting resolved filenames, Program source-file identity and unresolved status.
// @evidence contracts/testing.md#independent-expectations Expected target filenames and Program membership follow from the authored tsconfig files list, paths mapping and NodeNext exports map, independent of the shim implementation.
// @evidence contracts/testing.md#distinguishing-cases Covers a loaded unimported sibling, an unloaded sibling on disk, an unloaded package with exports conditions, a paths-mapped bare specifier pointing at a loaded file, and an absent specifier that must stay unresolved.
// @evidence contracts/testing.md#execution-ownership Go test discovers this unit directly under packages/ttsc/test/driver on both 7.0 and 7.1 targets; it loads one temporary project in process and closes the Program without installing a consumer or spawning a host.
func TestNeutralResolveModuleNameResolvesSpecifiersNoFileImports(t *testing.T) {
  root, err := filepath.EvalSymlinks(t.TempDir())
  if err != nil {
    t.Fatal(err)
  }
  files := map[string]string{
    "tsconfig.json":                 `{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[],"strict":true,"noEmit":true,"paths":{"@scope/mapped":["./loaded.ts"]}},"files":["index.ts","loaded.ts"]}`,
    "package.json":                  `{"type":"module"}`,
    "index.ts":                      `export const index = 1;`,
    "loaded.ts":                     `export const loaded = 2;`,
    "unloaded.ts":                   `export const unloaded = 3;`,
    "node_modules/pkg/package.json": `{"name":"pkg","version":"1.0.0","type":"module","exports":{".":{"types":"./index.d.ts","default":"./index.js"}}}`,
    "node_modules/pkg/index.d.ts":   `export declare const pkg: number;`,
    "node_modules/pkg/index.js":     `export const pkg = 4;`,
  }
  for name, text := range files {
    writeProjectFile(t, root, name, text)
  }
  prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil || driver.CountErrors(diagnostics) != 0 {
    t.Fatalf("load failed: %v; %v", err, diagnostics)
  }
  defer prog.Close()
  index := prog.SourceFile(filepath.Join(root, "index.ts"))
  if index == nil {
    t.Fatal("index.ts is not in the Program")
  }
  mode := prog.TSProgram.GetDefaultResolutionModeForFile(index)
  resolve := func(name string) (resolved bool, fileName string, inProgram bool) {
    resolution := shimcompiler.ResolveModuleName(prog.TSProgram, name, index.FileName(), mode)
    if resolution == nil {
      t.Fatalf("%s: the resolution is nil", name)
    }
    if !resolution.IsResolved() {
      return false, "", false
    }
    return true, string(resolution.ResolvedFileName), shimcompiler.SourceFileForResolvedModule(prog.TSProgram, resolution) != nil
  }

  // A sibling the Program holds, which index.ts does not import.
  resolved, fileName, inProgram := resolve("./loaded.js")
  if !resolved || !strings.HasSuffix(fileName, "/loaded.ts") || !inProgram {
    t.Fatalf("./loaded.js: resolved=%v file=%q inProgram=%v", resolved, fileName, inProgram)
  }
  if file := shimcompiler.SourceFileForResolvedModule(prog.TSProgram, shimcompiler.ResolveModuleName(prog.TSProgram, "./loaded.js", index.FileName(), mode)); file != prog.SourceFile(filepath.Join(root, "loaded.ts")) {
    t.Fatal("./loaded.js: the source file is not the Program's loaded.ts")
  }
  // A sibling and a package on disk that the Program never loaded.
  resolved, fileName, inProgram = resolve("./unloaded.js")
  if !resolved || !strings.HasSuffix(fileName, "/unloaded.ts") || inProgram {
    t.Fatalf("./unloaded.js: resolved=%v file=%q inProgram=%v", resolved, fileName, inProgram)
  }
  resolved, fileName, inProgram = resolve("pkg")
  if !resolved || !strings.HasSuffix(fileName, "/node_modules/pkg/index.d.ts") || inProgram {
    t.Fatalf("pkg: resolved=%v file=%q inProgram=%v", resolved, fileName, inProgram)
  }
  // A bare specifier the config's paths map onto a file the Program holds.
  resolved, fileName, inProgram = resolve("@scope/mapped")
  if !resolved || !strings.HasSuffix(fileName, "/loaded.ts") || !inProgram {
    t.Fatalf("@scope/mapped: resolved=%v file=%q inProgram=%v", resolved, fileName, inProgram)
  }
  // A name nothing provides.
  if resolved, fileName, _ = resolve("absent-package"); resolved {
    t.Fatalf("absent-package resolved to %q", fileName)
  }
}
