package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitAllWritesNoBuildInfoWithoutIncremental Verifies a nonincremental project emits
// JavaScript without creating build information.
//
// `tsBuildInfoFile` on its own does not ask for build information — tsgo writes
// it only when `incremental` or `composite` is on, which is exactly what
// `CompilerOptions.IsIncremental` tests and what the driver's emitsBuildInfo
// mirrors. Without this case an over-eager predicate (keying on
// `tsBuildInfoFile` being set, or routing every emit through the incremental
// lane) would look correct: the positive case would still pass while every
// ordinary project silently grew a `.tsbuildinfo` it never asked for.
//
// 1. Load a nonincremental project that nevertheless names a build-info path.
// 2. Call EmitAllRaw and require JavaScript while rejecting every build-info write.
//
// @evidence contracts/testing.md#behavioral-verification Calls EmitAllRaw for a project naming a build-info path without incremental, rejects every build-info output and requires JavaScript.
// @evidence contracts/testing.md#independent-expectations Authored tsBuildInfoFile alone does not enable incremental; literal dist/index.js and the absence of any .tsbuildinfo key define independent expectations.
// @evidence contracts/testing.md#distinguishing-cases Negative nonincremental raw emission contrasts both positive incremental lanes in the sibling test; ordinary JavaScript is retained as a success control.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit uses a private Program and write map in process and closes the Program without an external host.
func TestEmitAllWritesNoBuildInfoWithoutIncremental(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "tsBuildInfoFile": "cache/app.tsbuildinfo"
  },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "src/index.ts", "export const value: number = 1;\n")

  prog, configDiags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(configDiags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", configDiags)
  }
  defer prog.Close()

  written := map[string]string{}
  if _, diags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    written[filepath.ToSlash(fileName)] = text
    return nil
  }); err != nil || len(diags) != 0 {
    t.Fatalf("emit mismatch: diags=%#v err=%v", diags, err)
  }

  for name := range written {
    if strings.HasSuffix(name, ".tsbuildinfo") {
      t.Fatalf("build information written for a non-incremental project: %s", name)
    }
  }
  if written[filepath.ToSlash(filepath.Join(root, "dist", "index.js"))] == "" {
    t.Fatalf("JavaScript output missing; got %v", sortedStringKeys(written))
  }
}
