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
func TestLSPExecuteCommandCascadesFormatFixesWithoutMutatingDisk(t *testing.T) {
  source := "import { alpha, bravo, charlie } from 'long-module'\n" +
    "const x = { aa: 1, bb: 2, cc: 3 };\n"
  want := "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"long-module\";\n" +
    "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "format/print-width":    []any{"error", map[string]any{"printWidth": 20}},
      "format/semi":           "error",
      "format/quotes":         "error",
      "format/trailing-comma": "error",
    },
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
