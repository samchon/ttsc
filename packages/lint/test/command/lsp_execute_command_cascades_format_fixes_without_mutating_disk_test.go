package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandCascadesFormatFixesWithoutMutatingDisk verifies format
// reaches the formatter cascade fixed point.
//
// Format code actions should match `ttsc format` convergence while still
// returning a WorkspaceEdit for VSCode to apply. The sidecar computes the
// cascade in a temporary workspace so the command response remains non-mutating.
//
// 1. Seed a project with interacting print-width, semi, quotes, and trailing-comma rules.
// 2. Execute `ttsc.format.document` through the LSP command path.
// 3. Apply the returned WorkspaceEdit in memory and assert the cascaded output.
// 4. Assert the source file on disk was not modified by the sidecar.
// @evidence contracts/testing.md#behavioral-verification ttsc.format.document returns the complete authored multiline import/object result after interacting width, semi, quotes and comma passes, without changing source disk bytes.
// @evidence contracts/testing.md#independent-expectations The literal multiline result and original source bytes are independent answer keys for edit content and non-mutation, not outputs of another formatter path.
// @evidence contracts/testing.md#distinguishing-cases The source needs single-to-double quote conversion, a missing semicolon, a width-20 reflow of an import and an object, and trailing commas that only exist after the reflow, so the literal result is reachable only if the passes cascade; the file read back from disk must still be the original single-quote source, proving the edit was computed in a copy.
// @evidence contracts/testing.md#execution-ownership TestLSPExecuteCommandCascadesFormatFixesWithoutMutatingDisk owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestLSPExecuteCommandCascadesFormatFixesWithoutMutatingDisk(t *testing.T) {
  source := "import { alpha, bravo, charlie } from 'long-module'\n" +
    "const x = { aa: 1, bb: 2, cc: 3 };\n"
  want := "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"long-module\";\n" +
    "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n"
  root := seedLintProject(t, source)
  // Formatting is configured only through the format block; printWidth drives
  // format/print-width and the rest are always on.
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"printWidth": 20},
  })
  file := filepath.Join(root, "src", "main.ts")
  uri := lintTestFileURI(t, file)

  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandFormatDocument, source)
  if got != want {
    t.Fatalf("cascaded LSP format text mismatch:\nwant %q\ngot  %q", want, got)
  }
  disk, err := os.ReadFile(file)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(disk) != source {
    t.Fatalf("LSP command mutated disk:\nwant %q\ngot  %q", source, string(disk))
  }
}
