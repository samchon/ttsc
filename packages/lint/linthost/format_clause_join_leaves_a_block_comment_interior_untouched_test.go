package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinLeavesABlockCommentInteriorUntouched verifies the shift preserves this non-indentable comment's continuation line.
//
// The continuation begins with `b`, not `*`, so the comment does not satisfy
// the rule's indentable-comment predicate. Its interior is protected content,
// while the opening comment line and surrounding statements may outdent.
// Star-led comments have a separate adjacent case; this is not an assertion
// that every block comment retains all columns.
//
//  1. Seed a project with a labeled loop whose body holds a multi-line block comment.
//  2. Run `ttsc format`.
//  3. Assert the label joins and the comment's own lines keep their columns.
//
// @evidence contracts/testing.md#behavioral-verification The direct formatter must hoist the labeled loop and outdent structural lines while preserving the non-star block-comment interior. Complete source plus successful quiet command assertions distinguish changing authored comment spacing from moving surrounding layout.
// @evidence contracts/testing.md#independent-expectations The literal expected output follows the supported label indentation and the verbatim non-indentable block-comment policy. The interior b */ column is retained independently of the computed reindent delta.
// @evidence contracts/testing.md#distinguishing-cases This positive contains a non-indentable multiline comment inside a shifted loop. ReindentsAnIndentableBlockComment supplies the adjacent star-led comment form that must move, and string/template hosts cover other protected payloads.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinLeavesABlockCommentInteriorUntouched owns its fixture and direct run(format) status/stream/file assertions in the public Go unit population. All formatter work stays in process without a consumer install, native build or real product host.
func TestFormatClauseJoinLeavesABlockCommentInteriorUntouched(t *testing.T) {
  root := seedLintProject(t, "outer:\n  for (const x of xs) {\n    /* a\n       b */\n    visit(x);\n  }\n")
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
  if want := "outer: for (const x of xs) {\n  /* a\n       b */\n  visit(x);\n}\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
