package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresDecoratedNamespaceClassIndentFromFlat verifies the
// `ttsc format` cascade re-indents a decorated class DECLARATION STATEMENT
// nested inside a `namespace` — both its decorator line and its `class B`
// declaration line — from a fully flattened source. ttsc-only self-check
// against the canonical answer key.
//
// FIX C completion: a decorated declaration statement inside a ModuleBlock is
// visited by the statement pass at the namespace's body depth. Before the
// completion only the leading `@` line moved; the `class B` line stayed at
// column 0. This pins the namespace nesting depth, distinct from the
// function-nested case.
//
//  1. Flatten a namespace-nested decorated class canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
func TestCommandFormatRestoresDecoratedNamespaceClassIndentFromFlat(t *testing.T) {
  canonical := "namespace N {\n" +
    "  @Dec\n" +
    "  export class B {\n" +
    "    m() {\n" +
    "      g()\n" +
    "    }\n" +
    "  }\n" +
    "}\n"
  var flat strings.Builder
  for _, line := range strings.Split(canonical, "\n") {
    flat.WriteString(strings.TrimLeft(line, " \t"))
    flat.WriteString("\n")
  }
  source := strings.TrimSuffix(flat.String(), "\n")

  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{"format": map[string]any{"semi": false}})
  main := filepath.Join(root, "src", "main.ts")

  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{"format", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 0 || strings.Contains(stderr, "did not converge") {
    t.Fatalf("format did not converge: code=%d stderr=%q", code, stderr)
  }
  got, err := os.ReadFile(main)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != canonical {
    t.Fatalf("decorated namespace class indent not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
