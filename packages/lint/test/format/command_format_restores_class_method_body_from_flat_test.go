package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresClassMethodBodyFromFlat verifies the `ttsc
// format` cascade re-indents a class method body (and the method header and
// closing braces) from a fully flattened source. ttsc-only self-check: the
// canonical string is the answer key, Prettier is not consulted.
//
// format/indent's cede guard once keyed on the enclosing block's (possibly
// mangled) opener indent, which falsely ceded class method bodies whose
// `method() {` opener was flat — leaving the body at column 0 while the
// cascade reported success. The structural chained-arrow guard fixed it.
//
//  1. Flatten a two-method class canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
func TestCommandFormatRestoresClassMethodBodyFromFlat(t *testing.T) {
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
    t.Fatalf("class method body not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
