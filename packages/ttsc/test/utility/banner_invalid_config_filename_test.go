package ttsc_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerInvalidConfigFilename verifies explicit banner config paths
// must use the supported banner.config.* filename contract.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a valid project and a wrongly named config file.
// 2. Point the banner plugin at that explicit file.
// 3. Assert the loader rejects the filename before executing it.
func TestUtilityBannerInvalidConfigFilename(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the file exists, so the failure specifically covers the
  // supported config filename guard.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  writeProjectFile(t, root, "custom-banner.cjs", `module.exports = "Invalid Name Banner";
`)

  // Error assertion: explicit paths are still constrained to banner.config.*
  // so typoed filenames fail consistently with discovery.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"@ttsc/banner","config":{"config":"custom-banner.cjs"}}]`,
    })
  })
  if code != 2 || out != "" || !strings.Contains(errOut, "config file must be named") {
    t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
