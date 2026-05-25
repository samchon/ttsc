package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

// TestLSPExecuteCommandRejectsTargetOutsideCwdBeforeRead verifies command
// targets stay within the project boundary.
//
// LSP command arguments come from editor JSON-RPC. The sidecar should reject a
// file URI outside `--cwd` before reading that path, so malformed requests do
// not touch arbitrary files just to discover they cannot be copied.
//
// 1. Seed a normal lint project.
// 2. Create an unreadable file outside the project.
// 3. Execute `ttsc.lint.fixAll` for that outside URI.
// 4. Assert the error names the project-boundary rejection, not a read failure.
func TestLSPExecuteCommandRejectsTargetOutsideCwdBeforeRead(t *testing.T) {
  if runtime.GOOS == "windows" {
    t.Skip("chmod read checks differ on Windows")
  }
  root := seedLintProject(t, "var legacy = 1;\n")
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  outside := filepath.Join(t.TempDir(), "outside.ts")
  writeFile(t, outside, "var outside = 1;\n")
  if err := os.Chmod(outside, 0o000); err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() { _ = os.Chmod(outside, 0o644) })
  uri := lintTestFileURI(t, outside)
  argsJSON, err := json.Marshal([]string{uri})
  if err != nil {
    t.Fatal(err)
  }

  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-execute-command",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
      "--command", commandLintFixAll,
      "--arguments-json", string(argsJSON),
    })
  })
  if code == 0 {
    t.Fatal("outside-cwd command unexpectedly succeeded")
  }
  if !strings.Contains(stderr, "outside cwd") {
    t.Fatalf("outside-cwd rejection should happen before read, stderr=%q", stderr)
  }
}
