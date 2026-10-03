package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinKeepsABlankLineInsideAHoistedBody verifies a blank line inside a hoisted body neither shifts nor blocks the join.
//
// The continuation shift skips an empty line instead of assigning it an
// indentation edit. The command must finish with the label joined, ordinary
// body lines outdented and the separation between calls still empty. This
// final-output assertion does not observe an earlier implementation or compare
// an external formatter result.
//
//  1. Seed a project with a labeled loop whose body holds a blank line.
//  2. Run `ttsc format`.
//  3. Assert the label joins, the body outdents, and the blank line survives.
//
// @evidence contracts/testing.md#behavioral-verification The direct format operation must join and outdent the labeled loop while retaining its internal empty line. Status, streams and full file bytes detect a blank line blocking the hoist or acquiring unwanted indentation.
// @evidence contracts/testing.md#independent-expectations The expected label and two-space block layout follows the supported formatter policy; the original separation between a(); and b(); remains a literal empty line and both calls remain intact.
// @evidence contracts/testing.md#distinguishing-cases This positive combines a nonzero outdent with a truly empty continuation line. The zero-delta host covers unchanged columns, and protected-content hosts cover nonempty lines that must not move.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinKeepsABlankLineInsideAHoistedBody owns the project fixture, direct run(format) call and observable status/stream/file assertions in the public Go unit population. The filesystem and cascade are used in process without consumer installation, native building or a child host.
func TestFormatClauseJoinKeepsABlankLineInsideAHoistedBody(t *testing.T) {
  root := seedLintProject(t, "outer:\n  for (const x of xs) {\n    a();\n\n    b();\n  }\n")
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
  if want := "outer: for (const x of xs) {\n  a();\n\n  b();\n}\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
