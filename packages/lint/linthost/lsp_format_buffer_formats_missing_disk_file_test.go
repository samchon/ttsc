package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPFormatBufferFormatsMissingDiskFile proves the in-memory path does not
// require the target file to exist on disk at all — only the stdin buffer is
// formatted.
//
// A new editor buffer has no disk twin, so formatting must not require a successful target read.
//
//  1. Point a URI at an absent source and supply an unterminated buffer.
//  2. Require the literal terminated buffer result.
//
// @evidence contracts/testing.md#behavioral-verification The stdin command formats const y = 2 for a URI whose phantom target has never been written, detecting a disk-read prerequisite.
// @evidence contracts/testing.md#independent-expectations The absent temp fixture precondition and authored const y = 2 semicolon text are independent expectations, rather than repository file-presence checks.
// @evidence contracts/testing.md#distinguishing-cases A missing file distinguishes buffer-only admission from both existing equal-content and conflicting disk-content companion hosts.
// @evidence contracts/testing.md#execution-ownership The Go host parses and formats the supplied buffer in process using JSON settings; os.Stat checks only this disposable behavioral fixture.
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
