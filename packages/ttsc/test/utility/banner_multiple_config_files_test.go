package ttsc_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerMultipleConfigFiles verifies discovery rejects ambiguous
// banner config files in the same directory.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a project with two supported banner.config.* files.
// 2. Run the banner plugin without an explicit config path.
// 3. Assert discovery fails instead of picking one file nondeterministically.
func TestUtilityBannerMultipleConfigFiles(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: both files are valid names, so the only acceptable result
  // is the multiple-config guard in findBannerConfigFile.
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
  writeProjectFile(t, root, "banner.config.js", `export default "JS Banner";
`)
  writeProjectFile(t, root, "banner.config.cjs", `module.exports = "CJS Banner";
`)

  // Error assertion: ambiguity should stop at configuration time, before the
  // compiler host is allowed to run.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"@ttsc/banner"}]`,
    })
  })
  if code != 2 || out != "" || !strings.Contains(errOut, "multiple banner.config") {
    t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
