package linthost

import (
  "encoding/json"
  "io"
  "os"
  "testing"
)

// executeLSPFormatBufferAppliedTextForTest drives lsp-execute-command with
// --content-stdin, feeding `stdin` as the document buffer, and returns the
// buffer with the resulting WorkspaceEdit applied to `source`.
func executeLSPFormatBufferAppliedTextForTest(t *testing.T, root string, uri string, source string, stdin string) string {
  t.Helper()
  edit := executeLSPFormatBufferEditForTest(t, root, uri, stdin)
  if edit == nil || len(edit.Changes) != 1 || len(edit.Changes[uri]) == 0 {
    t.Fatalf("buffer format returned no unique edit for %q: %#v", uri, edit)
  }
  return applyLSPWorkspaceEditForTest(t, source, edit.Changes[uri])
}

func executeLSPFormatBufferEditForTest(t *testing.T, root string, uri string, stdin string) *lspWorkspaceEdit {
  t.Helper()
  argsJSON, err := json.Marshal([]string{uri})
  if err != nil {
    t.Fatal(err)
  }
  code, stdout, stderr := captureCommandOutputWithStdin(t, stdin, func() int {
    return run([]string{
      "lsp-execute-command",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
      "--command", commandFormatDocument,
      "--arguments-json", string(argsJSON),
      "--content-stdin",
    })
  })
  if code != 0 || stderr != "" {
    t.Fatalf("lsp-execute-command --content-stdin mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var edit lspWorkspaceEdit
  if err := json.Unmarshal([]byte(stdout), &edit); err != nil {
    t.Fatalf("lsp-execute-command JSON: %v\n%s", err, stdout)
  }
  return &edit
}

// captureCommandOutputWithStdin wraps captureCommandOutput, additionally
// replacing os.Stdin with a pipe pre-filled with `input` so the command under
// test reads `input` to EOF.
func captureCommandOutputWithStdin(t *testing.T, input string, fn func() int) (int, string, string) {
  t.Helper()
  prevIn := os.Stdin
  inReader, inWriter, err := os.Pipe()
  if err != nil {
    t.Fatal(err)
  }
  go func() {
    _, _ = io.WriteString(inWriter, input)
    _ = inWriter.Close()
  }()
  os.Stdin = inReader
  defer func() {
    os.Stdin = prevIn
    _ = inReader.Close()
  }()
  return captureCommandOutput(t, fn)
}
