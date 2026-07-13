package linthost

import (
  "encoding/json"
  "io"
  "os"
  "path/filepath"
  "testing"
)

// TestLSPFormatBufferMatchesDiskPath verifies the lightweight in-memory
// --content-stdin format path produces the SAME formatted text as the heavy
// disk-based lspWorkspaceEditForCommand for the same input buffer.
//
//  1. Seed a project + lint config with interacting format rules.
//  2. Format the buffer through the disk path (no --content-stdin).
//  3. Format the same buffer through the in-memory path (--content-stdin,
//     buffer fed on stdin).
//  4. Assert both applied texts agree.
func TestLSPFormatBufferMatchesDiskPath(t *testing.T) {
  source := "import { alpha, bravo, charlie } from 'long-module'\n" +
    "const x = { aa: 1, bb: 2, cc: 3 };\n"
  root := seedLintProject(t, source)
  // Formatting is configured only through the format block; printWidth drives
  // format/print-width and the rest are always on.
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"printWidth": 20},
  })
  file := filepath.Join(root, "src", "main.ts")
  uri := lintTestFileURI(t, file)

  diskText := executeLSPCommandAppliedTextForTest(t, root, uri, commandFormatDocument, source)
  bufferText := executeLSPFormatBufferAppliedTextForTest(t, root, uri, source, source)

  if bufferText != diskText {
    t.Fatalf("in-memory format text != disk format text:\ndisk   %q\nbuffer %q", diskText, bufferText)
  }
  if bufferText == source {
    t.Fatalf("expected formatting to change the buffer, got unchanged %q", bufferText)
  }
}

// TestLSPFormatBufferIgnoresDiskContent verifies the in-memory path formats the
// stdin buffer and never reads the target file from disk: the on-disk content
// is intentionally different from the passed buffer, and the result must
// reflect the buffer, not disk.
func TestLSPFormatBufferIgnoresDiskContent(t *testing.T) {
  // Disk holds DIFFERENT text from the buffer: the formatter must act on the
  // buffer (missing semicolon) and produce `const x = 1;`, never echo disk.
  diskContent := "const completely = 999;\n"
  buffer := "const x = 1\n"
  want := "const x = 1;\n"

  root := seedLintProject(t, diskContent)
  // An empty format block enables the always-on format rules (format/semi
  // among them); formatting is configured only through the format block.
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{},
  })
  file := filepath.Join(root, "src", "main.ts")
  uri := lintTestFileURI(t, file)

  got := executeLSPFormatBufferAppliedTextForTest(t, root, uri, buffer, buffer)
  if got != want {
    t.Fatalf("in-memory format reflected disk, not buffer:\nwant %q\ngot  %q", want, got)
  }

  // The on-disk file must remain untouched by the in-memory path.
  disk, err := os.ReadFile(file)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(disk) != diskContent {
    t.Fatalf("in-memory format mutated disk:\nwant %q\ngot  %q", diskContent, string(disk))
  }
}

// TestLSPFormatBufferFormatsMissingDiskFile proves the in-memory path does not
// require the target file to exist on disk at all — only the stdin buffer is
// formatted.
func TestLSPFormatBufferFormatsMissingDiskFile(t *testing.T) {
  root := seedLintProject(t, "const placeholder = 1;\n")
  // An empty format block enables the always-on format rules (format/semi
  // among them); formatting is configured only through the format block.
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{},
  })
  // Point the URI at a file that was never written to disk.
  missing := filepath.Join(root, "src", "phantom.ts")
  if _, err := os.Stat(missing); !os.IsNotExist(err) {
    t.Fatalf("expected %s to be absent on disk", missing)
  }
  uri := lintTestFileURI(t, missing)

  buffer := "const y = 2\n"
  want := "const y = 2;\n"
  got := executeLSPFormatBufferAppliedTextForTest(t, root, uri, buffer, buffer)
  if got != want {
    t.Fatalf("phantom-file in-memory format mismatch:\nwant %q\ngot  %q", want, got)
  }
}

// executeLSPFormatBufferAppliedTextForTest drives lsp-execute-command with
// --content-stdin, feeding `stdin` as the document buffer, and returns the
// buffer with the resulting WorkspaceEdit applied to `source`.
func executeLSPFormatBufferAppliedTextForTest(t *testing.T, root string, uri string, source string, stdin string) string {
  t.Helper()
  edit := executeLSPFormatBufferEditForTest(t, root, uri, stdin)
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
