package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinReindentsAnIndentableBlockComment verifies a JSDoc-shaped
// comment inside a hoisted body moves with it.
//
// Prettier reprints a block comment verbatim only when it is not indentable.
// One whose every continuation line starts with `*` is realigned to the current
// indentation, so protecting the whole class turned well-formed JSDoc into a
// misaligned block behind a hoisted body, and that was the cascade's fixed
// point. Its non-indentable twin lives in the sibling case.
//
//  1. Seed a project with a labeled loop whose body opens with a JSDoc block.
//  2. Run `ttsc format`.
//  3. Assert the comment's `*` lines move with the body.
//
// @evidence contracts/testing.md#behavioral-verification The direct formatter must hoist a labeled loop and realign every star-led JSDoc continuation with its new block column. Complete output and quiet successful status catch overprotecting all block comments and leaving this one misaligned.
// @evidence contracts/testing.md#independent-expectations The supported comment formatting policy aligns star-led continuation lines relative to the comment opening. Literal expected a text and comment delimiters retain their content while only leading layout changes.
// @evidence contracts/testing.md#distinguishing-cases The comment has every continuation line starting with a star after indentation, including its closing delimiter. LeavesABlockCommentInteriorUntouched supplies the non-star negative that retains interior columns.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinReindentsAnIndentableBlockComment owns the fixture and direct run(format) status/stream/file checks in the public Go unit population. The rule cascade executes in the same process without consumer installation, native compilation or a real product host.
func TestFormatClauseJoinReindentsAnIndentableBlockComment(t *testing.T) {
  root := seedLintProject(
    t,
    "outer:\n  for (const x of xs) {\n    /**\n     * a\n     */\n    visit(x);\n  }\n",
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
  want := "outer: for (const x of xs) {\n  /**\n   * a\n   */\n  visit(x);\n}\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
