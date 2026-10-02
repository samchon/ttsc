package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPFormatBufferIgnoresDiskContent verifies the in-memory path formats the
// stdin buffer and never reads the target file from disk: the on-disk content
// is intentionally different from the passed buffer, and the result must
// reflect the buffer, not disk.
//
// A saved document and unsaved buffer can disagree; disk fallback would return the wrong identifiers or edit coordinates.
//
//  1. Seed different disk and stdin source texts.
//  2. Format stdin and require its literal result while checking unchanged disk bytes.
//
// @evidence contracts/testing.md#behavioral-verification The stdin format command returns const x = 1 with its missing semicolon and leaves the unrelated disk document unchanged.
// @evidence contracts/testing.md#independent-expectations Literal const x = 1 semicolon output and original const completely = 999 disk bytes independently discriminate the two input sources.
// @evidence contracts/testing.md#distinguishing-cases Different identifiers and values on disk versus stdin expose fallback to disk; absent targets are exercised separately by the phantom-file host.
// @evidence contracts/testing.md#execution-ownership The native Go buffer formatter and captured in-process command share the unit process; its private stdin pipe is restored and launches no installed consumer.
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
