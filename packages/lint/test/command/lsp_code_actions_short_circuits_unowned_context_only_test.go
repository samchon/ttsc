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
// @evidence contracts/testing.md#behavioral-verification The dispatcher returns exit 0, literal [] JSON and silent stderr for an unrelated context.only even when no tsconfig exists.
// @evidence contracts/testing.md#independent-expectations The authored unowned action kind and missing disposable tsconfig establish the short-circuit boundary; literal status and JSON expectations do not depend on another command path.
// @evidence contracts/testing.md#distinguishing-cases The directory has a source file with a violation but no tsconfig and no lint config, so any attempt to load the project would fail with a nonzero status or stderr; success with exactly an empty array for context.only quickfix.other shows the project was never loaded. Owned kinds are covered by other code-action tests.
// @evidence contracts/testing.md#execution-ownership TestLSPCodeActionsShortCircuitsUnownedContextOnly owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
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
