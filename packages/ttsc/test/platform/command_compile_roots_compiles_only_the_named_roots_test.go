package ttsc_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestCommandCompileRootsCompilesOnlyTheNamedRoots verifies compile-roots
// builds a file its project does not list with every option of that project,
// and nothing else of the project.
//
// This is the command ttsx compiles an out-of-`include` entry through instead of
// writing a temporary tsconfig beside the user's. The `${configDir}` alias pins
// that the config is read where it lives, the decorator pins that its options
// apply, and the file only `include` names pins that its file list does not.
// The listed outputs are what the launcher parses, and the directory holds no
// config file afterwards.
//
//  1. Build a project whose `include` names `src`, with a script outside it that
//     imports through a `${configDir}` alias and uses a legacy decorator.
//  2. Run compile-roots with the script in TTSC_ROOT_FILES and a private outDir.
//  3. Assert success, the emitted script and its import, the absent file, the
//     listed outputs, and no new file beside the tsconfig.
func TestCommandCompileRootsCompilesOnlyTheNamedRoots(t *testing.T) {
  root := t.TempDir()
  writePlatformProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "strict": true,
    "experimentalDecorators": true,
    "outDir": "lib",
    "paths": { "#lib/*": ["${configDir}/src/*"] }
  },
  "include": ["src"]
}
`)
  writePlatformProjectFile(t, root, "src/value.ts", "export const value: number = 1;\n")
  writePlatformProjectFile(t, root, "src/unused.ts", "export const unused: number = 2;\n")
  writePlatformProjectFile(t, root, "scripts/run.ts", `import { value } from "#lib/value";
function probe(..._args: unknown[]): void {}
class Box {
  @probe
  method(): void {}
}
export const box: Box = new Box();
export const doubled: number = value * 2;
`)
  before := directoryNames(t, root)
  out := t.TempDir()
  payload, err := json.Marshal([]string{filepath.Join(root, "scripts", "run.ts")})
  if err != nil {
    t.Fatal(err)
  }
  t.Setenv(driver.RootFilesEnv, string(payload))

  code, stdout, stderr := runPlatformCommand(
    t,
    "compile-roots",
    "-p", filepath.Join(root, "tsconfig.json"),
    "--rootDir", root,
    "--outDir", out,
    "--listEmittedFiles",
  )
  if code != 0 {
    t.Fatalf("compile-roots failed: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  script, err := os.ReadFile(filepath.Join(out, "scripts", "run.js"))
  if err != nil {
    t.Fatalf("the root was not emitted: %v", err)
  }
  if !strings.Contains(string(script), "__decorate") {
    t.Fatalf("the project's experimentalDecorators did not apply:\n%s", script)
  }
  if _, err := os.Stat(filepath.Join(out, "src", "value.js")); err != nil {
    t.Fatalf("the file the root imports through the alias was not emitted: %v", err)
  }
  if _, err := os.Stat(filepath.Join(out, "src", "unused.js")); err == nil {
    t.Fatal("a file only the project's include names was emitted")
  }
  if !strings.Contains(stdout, "TSFILE: ") || !strings.Contains(stdout, "run.js") {
    t.Fatalf("the emitted files were not listed: %q", stdout)
  }
  if after := directoryNames(t, root); strings.Join(after, ",") != strings.Join(before, ",") {
    t.Fatalf("the project directory changed: before=%v after=%v", before, after)
  }
}
