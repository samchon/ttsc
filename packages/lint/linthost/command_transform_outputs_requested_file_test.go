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
//
// @evidence contracts/testing.md#behavioral-verification Actual transform selects the authored main.ts and returns its CommonJS exports.value = 1 output on stdout with zero status and no stderr.
// @evidence contracts/testing.md#independent-expectations Literal source export and value one independently define the emitted assignment; temporary fixture paths supply behavioral target selection rather than a committed-file presence check.
// @evidence contracts/testing.md#distinguishing-cases Canonical source path contrasts with the dot-segment spelling unit; this one-source project verifies successful target emission without claiming unrelated-output exclusion across multiple sources.
// @evidence contracts/testing.md#execution-ownership Real command dispatch, in-process project diagnostics and compiler target emit execute in the shared Go process, without an installed CLI, native plugin producer or external compiler process.
func TestCommandTransformOutputsRequestedFile(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  seedLintRules(t, root, map[string]string{"no-var": "off"})
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
  if !strings.Contains(stdout, "exports.value = 1;") {
    t.Fatalf("target output lost authored export value: %q", stdout)
  }
}
