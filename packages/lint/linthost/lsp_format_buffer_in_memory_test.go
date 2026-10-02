package linthost

import (
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
//
// @evidence contracts/testing.md#behavioral-verification Disk command and stdin buffer command both return the authored multiline import/object text; agreeing on the same wrong formatting now fails.
// @evidence contracts/testing.md#independent-expectations The literal double quotes, semicolons, three import entries, three object entries and 20-column line breaks are authored independently of either output.
// @evidence contracts/testing.md#distinguishing-cases The same unformatted input crosses disk and buffer paths with interacting width rules; the unequal disk-content and absent-file companions own different admission boundaries.
// @evidence contracts/testing.md#execution-ownership Both commands call the Go host in process using a JSON fixture and native formatter, without Node, installation, contributor compilation or an external formatter.
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

  want := "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"long-module\";\nconst x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n"
  if diskText != want || bufferText != want {
    t.Fatalf("format paths violated authored text: want %q disk %q buffer %q", want, diskText, bufferText)
  }
  if bufferText != diskText {
    t.Fatalf("in-memory format text != disk format text:\ndisk   %q\nbuffer %q", diskText, bufferText)
  }
  if bufferText == source {
    t.Fatalf("expected formatting to change the buffer, got unchanged %q", bufferText)
  }
}
