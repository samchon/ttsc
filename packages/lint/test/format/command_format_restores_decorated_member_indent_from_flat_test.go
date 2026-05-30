package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandFormatRestoresDecoratedMemberIndentFromFlat verifies the `ttsc
// format` cascade re-indents a decorated class member's decorator lines AND
// its declaration line from a fully flattened source, converging on the
// canonical layout. ttsc-only self-check: the canonical string is the answer
// key (Prettier is consulted for the target shape, not at runtime).
//
// format/indent's header pass used to re-indent only lineStart(member.Pos()),
// which for a decorated member is the leading `@`, so a flattened class left
// each `name: type` declaration line at column 0 while its decorator line
// moved — a half-indented member the cascade reported as success. Running the
// whole cascade also proves the decorator-line work converges and is
// idempotent (no oscillation against print-width / semi).
//
//  1. Flatten a decorated-member class canonical to column 0.
//  2. Run `ttsc format`.
//  3. Assert it converges and restores the canonical exactly.
func TestCommandFormatRestoresDecoratedMemberIndentFromFlat(t *testing.T) {
  canonical := "class User {\n" +
    "  @Column()\n" +
    "  name: string = \"\"\n" +
    "  @Index()\n" +
    "  @Column({ nullable: true })\n" +
    "  email?: string\n" +
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
    t.Fatalf("decorated member indent not restored:\ngot  %q\nwant %q", string(got), canonical)
  }
}
