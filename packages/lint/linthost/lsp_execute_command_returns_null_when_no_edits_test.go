package linthost

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestLSPExecuteCommandReturnsNullWhenNoEdits verifies command no-ops use the
// protocol's null edit response.
//
// `ttscserver` treats JSON null from an LSP sidecar as a handled command with
// no workspace changes. Returning an empty WorkspaceEdit would make the editor
// do pointless apply-edit work and diverges from the public sidecar contract.
//
// 1. Seed a project whose lint rules produce no fixable diagnostics.
// 2. Execute `ttsc.lint.fixAll` through the LSP command path.
// 3. Assert exit 0 and stdout is JSON `null`.
//
// @evidence contracts/testing.md#behavioral-verification Fix-all on a const-only source exits successfully with JSON null and no stderr rather than an empty WorkspaceEdit.
// @evidence contracts/testing.md#independent-expectations Literal null protocol output, zero exit and empty stderr are authored expectations independent of edit serialization internals.
// @evidence contracts/testing.md#distinguishing-cases Enabled no-var on an already valid source distinguishes a handled no-op from disabled rules or a positive rewrite, which the split-edits companion owns.
// @evidence contracts/testing.md#execution-ownership The native Go LSP command and checker execute directly in the shared unit process with a disposable fixture and no subprocess.
func TestLSPExecuteCommandReturnsNullWhenNoEdits(t *testing.T) {
  root := seedLintProject(t, "const stable = 1;\nJSON.stringify(stable);\n")
  seedLintRules(t, root, map[string]string{
    "no-var": "error",
  })
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  argsJSON, err := json.Marshal([]string{uri})
  if err != nil {
    t.Fatal(err)
  }
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-execute-command",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
      "--command", commandLintFixAll,
      "--arguments-json", string(argsJSON),
    })
  })

  if code != 0 || stderr != "" {
    t.Fatalf("lsp-execute-command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if strings.TrimSpace(stdout) != "null" {
    t.Fatalf("expected null edit response, got %q", stdout)
  }
}
