package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// assertFormatUnchanged seeds a project with `src`, runs `ttsc format` with a
// default `format: {}` block, and asserts the file on disk is byte-identical
// to `src`. Used by the indentation idempotency suite: each `src` is already
// Prettier-canonical, so a well-behaved formatter must leave it untouched.
// A failure means a format rule de-indented (or otherwise mangled) source
// that was already correct.
func assertFormatUnchanged(t *testing.T, src string) {
  t.Helper()
  root := seedLintProject(t, src)
  seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format", "--cwd", root, "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 {
    t.Fatalf("format failed: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != src {
    t.Fatalf("format altered already-correct source:\nwant %q\ngot  %q", src, string(got))
  }
}
