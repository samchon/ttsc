package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresClassMemberIndentFromFlat verifies the `ttsc
// format` cascade re-indents class member headers, their bodies, and their
// closing braces from a fully flattened source. ttsc-only self-check: the
// canonical string is the answer key (Prettier is not consulted).
//
// format/indent's statement walk never visits a member declaration header
// (a method/property is not a statement), so before the member-header pass a
// flattened class left every `method() {` at column 0 while its body was
// re-indented — a malformed result the cascade reported as success.
//
//  1. Flatten a two-method class canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
func TestCommandFormatRestoresClassMemberIndentFromFlat(t *testing.T) {
  canonical := "class C {\n" +
    "  a() {\n" +
    "    f()\n" +
    "  }\n" +
    "  b() {\n" +
    "    g()\n" +
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
    t.Fatalf("class member indent not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
