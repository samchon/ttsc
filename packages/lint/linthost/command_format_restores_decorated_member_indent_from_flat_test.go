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
// @evidence contracts/testing.md#behavioral-verification Strips the leading whitespace from every line of an authored class with two decorated properties (one with two decorators), runs the in-process `format` command (semi false), and requires exit 0 without a did-not-converge message and the file equal to the authored indented class.
// @evidence contracts/testing.md#independent-expectations The expected text is an authored canonical literal; the flat input is derived from it by removing leading whitespace, which leaves the syntax tree identical.
// @evidence contracts/testing.md#distinguishing-cases One input that must change: both the decorator lines and the `name: type` declaration line of each member begin at column 0 and must be moved together; a header pass that moved only the `@` line would leave the declaration lines at column 0.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
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
