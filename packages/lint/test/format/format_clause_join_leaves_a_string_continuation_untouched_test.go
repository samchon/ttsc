package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinLeavesAStringContinuationUntouched verifies the shift never rewrites bytes inside a string literal.
//
// A string literal with a line continuation carries its own newline, and the
// spaces after it are part of the value. Shifting that line collapsed the run
// of spaces inside the value, changing what the program prints rather than how
// it reads. Only the template literal was guarded; a string is the same hazard.
//
//  1. Seed a project with a label whose body holds a line-continued string.
//  2. Run `ttsc format`.
//  3. Assert the label joins and the string's interior spacing is byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification The direct formatter must join the label while retaining the line-continued string interior bytes. Full source, successful status and quiet streams detect an outdent that changes spaces belonging to the string value.
// @evidence contracts/testing.md#independent-expectations An escaped newline continues the string and the following spaces belong to its value; only the label-to-run gap is layout. The literal oracle preserves those spaces exactly and does not reuse the reindent implementation.
// @evidence contracts/testing.md#distinguishing-cases The multiline string is protected while its surrounding labeled call changes. Value-template and template-type hosts cover distinct syntax forms with the same content-preservation obligation.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinLeavesAStringContinuationUntouched owns its fixture config, direct run(format) invocation and file/stream/status assertions in the public Go unit population. No consumer installation, native artifact builder or child product host is used.
func TestFormatClauseJoinLeavesAStringContinuationUntouched(t *testing.T) {
  root := seedLintProject(t, "outer:\n  run(\"a\\\n   b\");\n")
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
  if want := "outer: run(\"a\\\n   b\");\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
