package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramRootFilesReplaceTheConfigFileList verifies an explicit root
// list builds the program from those files with every option of the config.
//
// `ttsx` runs files its owning project does not list, such as a script beside
// a tsconfig whose `include` names only `src`. The config is parsed where it
// lives, so `${configDir}` and the type lookups keep their meaning, and only
// its file list is replaced. The twin load without roots pins that the config's
// own list is untouched otherwise, and the dropped reference pins that a
// replaced list no longer asks the program to build another project's files.
//
// 1. Build a project whose `include` names `src`, with a script outside it that
//    imports from `src` through a `${configDir}` path alias, and a project
//    reference.
// 2. Load it with the script as the only root, and again with no roots.
// 3. Assert the roots, the imported file, the preserved options, and the
//    dropped reference, then the unchanged list of the twin.
func TestLoadProgramRootFilesReplaceTheConfigFileList(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "strict": true,
    "experimentalDecorators": true,
    "outDir": "dist",
    "paths": { "#lib/*": ["${configDir}/src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./other" }]
}
`)
  writeProjectFile(t, root, "other/tsconfig.json", `{
  "compilerOptions": { "composite": true },
  "include": ["*.ts"]
}
`)
  writeProjectFile(t, root, "other/index.ts", "export const other = 1;\n")
  writeProjectFile(t, root, "src/value.ts", "export const value: number = 1;\n")
  writeProjectFile(t, root, "src/unused.ts", "export const unused: number = 2;\n")
  writeProjectFile(t, root, "scripts/run.ts", `import { value } from "#lib/value";
export const doubled: number = value * 2;
`)
  script := filepath.Join(root, "scripts", "run.ts")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    RootFiles: []string{script},
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected load diagnostics: %#v", diags)
  }
  defer prog.Close()
  if diags := prog.Diagnostics(); len(diags) != 0 {
    t.Fatalf("the script did not type-check through the config's options: %#v", diags)
  }
  roots := prog.ParsedConfig.FileNames()
  if len(roots) != 1 || roots[0] != tspath.NormalizePath(script) {
    t.Fatalf("roots = %#v, want only the script", roots)
  }
  if prog.SourceFile(tspath.NormalizePath(filepath.Join(root, "src", "value.ts"))) == nil {
    t.Fatal("the file the script imports through the config's path alias is missing")
  }
  if prog.SourceFile(tspath.NormalizePath(filepath.Join(root, "src", "unused.ts"))) != nil {
    t.Fatal("a file only the config's include names entered the program")
  }
  options := prog.ParsedConfig.CompilerOptions()
  if !options.Strict.IsTrue() || !options.ExperimentalDecorators.IsTrue() {
    t.Fatal("the config's compiler options did not survive the replaced list")
  }
  if references := prog.ParsedConfig.ProjectReferences(); len(references) != 0 {
    t.Fatalf("references survived the replaced list: %#v", references)
  }

  twin, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected twin load diagnostics: %#v", diags)
  }
  defer twin.Close()
  if twin.SourceFile(tspath.NormalizePath(script)) != nil {
    t.Fatal("the config's own list reached a file outside its include")
  }
  if len(twin.ParsedConfig.ProjectReferences()) != 1 {
    t.Fatal("the config's own references were dropped without a replaced list")
  }
}
