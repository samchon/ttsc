package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLoadProgramAppliesTsgoArgsOverlay verifies forwarded tsgo CLI flags
// override the tsconfig for an in-process program.
//
// A plugin build constructs its Program through driver.LoadProgram instead of
// shelling out to `tsgo`, so a `ttsc --strict` the launcher could not satisfy
// on the tsgo lane arrives as LoadProgramOptions.TsgoArgs. The driver replays
// the flag through TypeScript-Go's own option parser and merges it over the
// tsconfig with the CLI winning — this pins that merge.
//
// 1. Build a project whose tsconfig sets `strict: false`.
// 2. Load it with TsgoArgs ["--strict"].
// 3. Assert the resolved CompilerOptions report strict mode on.
func TestDriverLoadProgramAppliesTsgoArgsOverlay(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "strict": false,
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const value = 1;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    TsgoArgs: []string{"--strict"},
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  if !prog.ParsedConfig.ParsedConfig.CompilerOptions.Strict.IsTrue() {
    t.Fatal("--strict from TsgoArgs did not override the tsconfig strict:false")
  }
}
