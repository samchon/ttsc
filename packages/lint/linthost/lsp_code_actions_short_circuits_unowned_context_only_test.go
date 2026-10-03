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
//
// @evidence contracts/testing.md#behavioral-verification The dispatcher returns exit 0, literal [] JSON and silent stderr for an unrelated context.only even when no tsconfig exists.
// @evidence contracts/testing.md#independent-expectations The authored unowned action kind and missing disposable tsconfig establish the short-circuit boundary; literal status and JSON expectations do not depend on another command path.
// @evidence contracts/testing.md#distinguishing-cases The directory contains a var source but no tsconfig or lint config. Exact success, empty JSON and silent stderr constrain the unowned-kind response; the current dispatcher returns before lspFindings, as confirmed by its control flow. The assertions do not count project loads or detect every possible filesystem read. Owned kinds are covered by other code-action tests.
// @evidence contracts/testing.md#execution-ownership Calls run lsp-code-actions in process with captured streams on a temporary directory that has no tsconfig; no editor or built host is started.
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
