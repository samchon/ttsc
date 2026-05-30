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
