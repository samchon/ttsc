package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandBuildEmitsProjectOutput verifies build writes clean project output.
//
// Build shares the check diagnostic path and then runs the tsgo emit pipeline
// when no error diagnostics remain. The branch must write output files through
// defaultWriteFile rather than only returning success.
//
// This scenario covers loadProgram emit overrides, runProject's emit callback,
// and the filesystem side effect that native hosts rely on for build mode. The
// scenario also passes --outDir so command-line output directory overrides stay
// covered.
//
// 1. Create a clean project with one exported value.
// 2. Run build with --emit and a discovered lint config.
// 3. Assert custom/main.js is written and contains the emitted export.
func TestCommandBuildEmitsProjectOutput(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  seedLintRules(t, root, map[string]string{"no-var": "off"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "build",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
      "--emit",
      "--outDir", "custom",
      "--quiet",
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("build mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  data, err := os.ReadFile(filepath.Join(root, "custom", "main.js"))
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(string(data), "exports.value") {
    t.Fatalf("emitted JavaScript missing export: %s", data)
  }
}
