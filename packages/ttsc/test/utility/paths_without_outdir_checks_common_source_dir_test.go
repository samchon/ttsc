package ttsc_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityPathsWithoutOutDirChecksCommonSourceDir verifies the paths plugin
// can prepare a project without rootDir/outDir and still pass check mode.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create two source files under a shared directory without outDir.
// 2. Run utility check with the paths plugin.
// 3. Assert setup succeeds, covering common source directory inference.
func TestUtilityPathsWithoutOutDirChecksCommonSourceDir(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: without outDir there is no emitted path to rewrite, but
  // newPathsRewriter still computes the common source directory.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "paths": {
      "@lib/*": ["./src/lib/*"]
    }
  },
  "files": ["src/main.ts", "src/lib/value.ts"]
}
`)
  writeProjectFile(t, root, "src/main.ts", `import { value } from "@lib/value";
export const result = value;
`)
  writeProjectFile(t, root, "src/lib/value.ts", `export const value = 1;
`)

  // Check assertion: this covers the no-output preparation path without
  // triggering tsgo's rootDir requirement for outDir.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"@ttsc/paths"}]`,
    })
  })
  if code != 0 || out != "" || errOut != "" {
    t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
