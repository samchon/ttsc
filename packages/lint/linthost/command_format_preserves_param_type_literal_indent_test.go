package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatPreservesParamTypeLiteralIndent preserves a method's
// parameter type whose members sit one level beyond the `input:` line and
// whose brace closes at that line's column. The same file includes a flat
// parameter literal. Format must preserve both layouts and every parameter,
// optional member type and method return type byte-for-byte.
//
//  1. Seed an interface whose method parameter is `Payload & { ... }` with a broken literal, plus a flat parameter literal.
//  2. Run `ttsc format` with an empty format block.
//  3. Require exit 0 and the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on an interface whose method parameter `input: Payload & { ... }` has its literal members one level deeper than the `input:` line and its brace closing at that column, plus a flat `count(arg: { where: Where })`, and requires exit 0 and the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently preserves aliases, both parameter layouts, optional member types including the OrderBy union/array, and method return types; no independent Prettier invocation establishes the expected bytes.
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
