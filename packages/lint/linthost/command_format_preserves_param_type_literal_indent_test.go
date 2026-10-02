package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatPreservesParamTypeLiteralIndent reproduces a regression
// where the nested type literal of a method-signature parameter is
// re-indented one level too shallow. Prettier indents the members of
// `input: Payload & { ... }` one level deeper than the `input:` line and
// closes the brace at the `input:` column; the format pipeline must keep
// this already-correct layout byte-identical (idempotent).
//
//  1. Seed an interface whose method parameter is `Payload & { ... }` with a broken literal, plus a flat parameter literal.
//  2. Run `ttsc format` with an empty format block.
//  3. Require exit 0 and the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on an interface whose method parameter `input: Payload & { ... }` has its literal members one level deeper than the `input:` line and its brace closing at that column, plus a flat `count(arg: { where: Where })`, and requires exit 0 and the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The source is an authored literal in Prettier's layout and serves as its own expected output.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case with a broken parameter literal and a flat one in the same file; a formatter that re-indented the broken literal to block depth would fail. No mis-indented input is repaired here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatPreservesParamTypeLiteralIndent(t *testing.T) {
  src := `type Payload = object;
type Where = object;
type OrderBy = object;
export interface IProps {
  schema: {
    findMany(
      input: Payload & {
        skip?: number;
        take?: number;
        where?: Where;
        orderBy?: OrderBy | OrderBy[];
      },
    ): Promise<Where[]>;
    count(arg: { where: Where }): Promise<number>;
  };
}
`
  root := seedLintProject(t, src)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{},
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 {
    t.Fatalf("format command failed: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != src {
    t.Fatalf("format altered already-correct indentation:\nwant %q\ngot  %q", src, string(got))
  }
}
