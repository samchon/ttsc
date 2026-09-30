package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// assertFormatUnchanged seeds a project with `src`, runs `ttsc format` with a
// default `format: {}` block, and asserts the file on disk is byte-identical
// to `src`. Used for canonical indentation and source-preservation boundaries
// such as comment-bearing syntax the formatter must leave intact. The caller
// owns the unchanged-output premise; this helper does not establish that every
// source matches Prettier's complete output.
func assertFormatUnchanged(t *testing.T, src string) {
  t.Helper()
  assertFormatResult(t, src, src)
}

// assertFormatResult seeds a project with `src`, runs `ttsc format` with a
// default `format: {}` block, and asserts the file on disk equals `want`. Use
// for active transformations with a caller-authored expected output, while
// assertFormatUnchanged covers cases whose output must equal their input.
func assertFormatResult(t *testing.T, src, want string) {
  t.Helper()
  assertFormatResultWithFormat(t, src, want, map[string]any{})
}

// assertFormatUnchangedWithFormat is assertFormatUnchanged with a non-default
// format block (e.g. a different tabWidth or printWidth).
func assertFormatUnchangedWithFormat(t *testing.T, src string, format map[string]any) {
  t.Helper()
  assertFormatResultWithFormat(t, src, src, format)
}

// assertFormatResultWithFormat is assertFormatResult parameterized on the
// `format` block contents.
func assertFormatResultWithFormat(t *testing.T, src, want string, format map[string]any) {
  t.Helper()
  root := seedLintProject(t, src)
  seedLintConfig(t, root, map[string]any{"format": format})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format", "--cwd", root, "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 {
    t.Fatalf("format failed: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != want {
    t.Fatalf("format result mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
