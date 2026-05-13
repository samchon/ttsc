package ttsc_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBannerEmptyTextReportsError verifies inline banner text must be a
// non-empty string.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a valid project.
// 2. Configure `@ttsc/banner` with whitespace-only text.
// 3. Assert utility check reports the banner configuration error.
func TestUtilityBannerEmptyTextReportsError(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: an otherwise valid project keeps the assertion focused on
  // bannerTextFromConfigValue's inline string validation.
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

  // Error assertion: empty text should not silently produce an empty preamble.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"@ttsc/banner","config":{"text":"   "}}]`,
    })
  })
  if code != 2 || out != "" || !strings.Contains(errOut, `"text" must be a non-empty string`) {
    t.Fatalf("RunCheck mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
