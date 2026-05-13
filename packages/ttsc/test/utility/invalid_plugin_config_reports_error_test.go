package ttsc_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityInvalidPluginConfigReportsError verifies first-party utility
// plugin configuration errors fail before emit.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a valid TypeScript project.
// 2. Run the utility check entrypoint with an invalid strip statement pattern.
// 3. Assert the command-sidecar path returns a non-zero status and message.
func TestUtilityInvalidPluginConfigReportsError(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the project itself is valid so any failure must come from
  // plugin configuration validation.
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

  // Failure assertion: unsupported strip statements are rejected with the
  // plugin name in stderr so wrapper diagnostics can point at the right plugin.
  code, _, errOut := captureUtilityOutput(t, func() int {
    return utility.RunCheck([]string{
      "--cwd", root,
      "--plugins-json", `[{"name":"@ttsc/strip","config":{"statements":["debugger","with"]}}]`,
    })
  })
  if code != 2 {
    t.Fatalf("invalid strip config should fail: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(errOut, "@ttsc/strip") || !strings.Contains(errOut, "unsupported statement pattern") {
    t.Fatalf("invalid strip config message mismatch: %q", errOut)
  }
}
