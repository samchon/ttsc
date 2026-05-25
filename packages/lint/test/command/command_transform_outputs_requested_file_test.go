package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandTransformOutputsRequestedFile verifies transform emits one source file.
//
// Transform runs diagnostics for the whole project but returns only the
// requested JavaScript output. This branch is how plugin hosts ask the sidecar
// for a single rewritten file over stdout.
//
// This scenario uses a real project so findSourceFile, collectDiagnostics, and
// the TargetSourceFile emit callback all execute together.
//
// 1. Create a clean project with one TypeScript source file.
// 2. Run transform with --file pointing at that source.
// 3. Assert stdout contains the emitted JavaScript for the requested file.
func TestCommandTransformOutputsRequestedFile(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  seedLintRules(t, root, map[string]string{"noVar": "off"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "transform",
      "--cwd", root,
      "--file", filepath.Join(root, "src", "main.ts"),
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stderr != "" || !strings.Contains(stdout, "exports.value") {
    t.Fatalf("transform mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
