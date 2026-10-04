package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramAppliesAForwardedNullReset Verifies that forwarded null resets clear declarationDir and tsBuildInfoFile and avoid TS5069; the no-reset twin retains declarationDir and reports TS5069.
//
// The same config is loaded with and without resets; outFile and actual emitted files are not asserted.
//
// 1. Build a project whose config declares `declarationDir` and a `tsBuildInfoFile`.
// 2. Load it with `--declaration false` and both locations reset to `null`, then with `--declaration false` alone.
// 3. Assert the reset clears both options and the Program reports nothing, and that without it the config's `declarationDir` stays and TS5069 follows.
//
// @evidence contracts/testing.md#behavioral-verification Forwarded null resets clear declarationDir and tsBuildInfoFile and avoid TS5069; the no-reset twin retains declarationDir and reports TS5069.
// @evidence contracts/testing.md#independent-expectations Explicit CLI null reset semantics and declaration-disabled option conflict define the expected fields and code.
// @evidence contracts/testing.md#distinguishing-cases The same config is loaded with and without resets; outFile and actual emitted files are not asserted.
// @evidence contracts/testing.md#execution-ownership Both Programs use direct Go TsgoArgs loading and are explicitly closed. Go discovers TestLoadProgramAppliesAForwardedNullReset under ./test/driver.
func TestLoadProgramAppliesAForwardedNullReset(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "rootDir": "src",
    "outDir": "lib",
    "declaration": true,
    "declarationDir": "types",
    "incremental": true,
    "tsBuildInfoFile": "build/app.tsbuildinfo"
  },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "src/index.ts", "export const value = 1;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    TsgoArgs: []string{
      "--declaration", "false",
      "--declarationDir", "null",
      "--tsBuildInfoFile", "null",
    },
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected load diagnostics: %#v", diags)
  }
  progClosed := false
  defer func() {
    if !progClosed {
      prog.Close()
    }
  }()
  options := prog.ParsedConfig.CompilerOptions()
  if options.DeclarationDir != "" || options.TsBuildInfoFile != "" {
    t.Fatalf("the reset did not apply: declarationDir=%q tsBuildInfoFile=%q", options.DeclarationDir, options.TsBuildInfoFile)
  }
  if diags := prog.Diagnostics(); len(diags) != 0 {
    t.Fatalf("the reset program reported diagnostics: %#v", diags)
  }
  prog.Close()
  progClosed = true

  twin, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    TsgoArgs: []string{"--declaration", "false"},
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected twin load diagnostics: %#v", diags)
  }
  defer twin.Close()
  if twin.ParsedConfig.CompilerOptions().DeclarationDir == "" {
    t.Fatal("the config's declarationDir was dropped without a reset")
  }
  found := false
  for _, diag := range twin.Diagnostics() {
    if diag.Code == 5069 {
      found = true
    }
  }
  if !found {
    t.Fatal("expected TS5069 for a declarationDir without declaration")
  }
}
