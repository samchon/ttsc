package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLoadProgramAppliesAForwardedNullReset verifies a forwarded `null` resets
// the config's option the way TypeScript-Go's own command line does.
//
// ttsc keeps every output of a private build in one directory by forwarding
// `--declarationDir null`, `--tsBuildInfoFile null`, and `--outFile null`
// (`TsgoArguments.isolatedTsgoOutputArgs`). The parsed CompilerOptions cannot
// carry a reset: the field stays at its zero value, which the config merge reads
// as "not given", so the config's own location survived. That wrote build
// information into the user's tree and, beside `--declaration false`, failed
// the build with TS5069. The command line's raw options carry the explicit
// null, and TypeScript-Go's command line hands them to the merge; the twin
// without the reset pins that the config's value is otherwise kept.
//
//  1. Build a project whose config declares `declarationDir` and a
//     `tsBuildInfoFile`.
//  2. Load it with `--declaration false` and both locations reset to `null`,
//     then with `--declaration false` alone.
//  3. Assert the reset clears both options and the Program reports nothing, and
//     that without it the config's `declarationDir` stays and TS5069 follows.
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
  options := prog.ParsedConfig.CompilerOptions()
  if options.DeclarationDir != "" || options.TsBuildInfoFile != "" {
    t.Fatalf("the reset did not apply: declarationDir=%q tsBuildInfoFile=%q", options.DeclarationDir, options.TsBuildInfoFile)
  }
  if diags := prog.Diagnostics(); len(diags) != 0 {
    t.Fatalf("the reset program reported diagnostics: %#v", diags)
  }
  prog.Close()

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
