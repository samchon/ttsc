package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinLeavesATemplateLiteralTypeUntouched verifies a template
// literal in TYPE position is protected like one in value position.
//
// `collectTemplateRanges` matched the expression forms only, so a
// `TemplateLiteralType` fell through and the shift rewrote bytes inside the
// declared type's own text. It is the same content-versus-layout class as the
// string and the block comment, and the helper is shared with
// `format/whitespace`, so the gap reached further than this rule.
//
//  1. Seed a project with a labeled block declaring a multi-line template type.
//  2. Run `ttsc format`.
//  3. Assert the label joins and the type's interior spacing is byte-identical.
func TestFormatClauseJoinLeavesATemplateLiteralTypeUntouched(t *testing.T) {
  root := seedLintProject(
    t,
    "outer:\n  {\n    const v: `a${string}\n     b` = z;\n  }\n",
  )
  seedLintConfig(t, root, map[string]any{"format": map[string]any{}})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  want := "outer: {\n  const v: `a${string}\n     b` = z;\n}\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
