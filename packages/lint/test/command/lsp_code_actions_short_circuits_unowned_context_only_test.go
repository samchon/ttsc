package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPCodeActionsShortCircuitsUnownedContextOnly verifies unrelated
// CodeActionKind requests do not load the project.
//
// When a client asks only for kinds @ttsc/lint cannot provide, the sidecar can
// answer `[]` immediately. This avoids unnecessary tsconfig/project work on
// sibling quickfix requests.
//
// 1. Create a directory without a tsconfig.
// 2. Run `lsp-code-actions` with an unrelated `context.only`.
// 3. Assert success with an empty action array.
func TestLSPCodeActionsShortCircuitsUnownedContextOnly(t *testing.T) {
  root := t.TempDir()
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  if err := os.MkdirAll(filepath.Join(root, "src"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(root, "src", "main.ts"), []byte("var x = 1\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-code-actions",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
      "--uri", uri,
      "--range-json", `{"start":{"line":0,"character":0},"end":{"line":0,"character":1}}`,
      "--context-json", `{"only":["quickfix.other"]}`,
    })
  })
  if code != 0 || stdout != "[]\n" || stderr != "" {
    t.Fatalf("lsp-code-actions mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
