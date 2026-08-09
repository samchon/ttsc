package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinShiftsATabIndentedBodyWithTabs verifies the shift renders columns in the project's own indentation unit.
//
// Rendering the new column as spaces silently respaced a tab-indented file, and
// `format/indent` cedes braceless bodies so nothing converted it back. The rule
// now builds the indent through the shared layout helper the other structural
// rules use.
//
//  1. Seed a tab-indented project with `useTabs` and an `else if` chain.
//  2. Run `ttsc format`.
//  3. Assert the shifted line is indented with a tab.
func TestFormatClauseJoinShiftsATabIndentedBodyWithTabs(t *testing.T) {
  root := seedLintProject(t, "if (a)\n\tx();\nelse\n\tif (b)\n\t\taVeryLongFunctionNameThatGoesOnAndOn(argumentOne, argumentTwo, three);\n")
  seedLintConfig(t, root, map[string]any{"format": map[string]any{"useTabs": true}})
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
  if want := "if (a) x();\nelse if (b)\n\taVeryLongFunctionNameThatGoesOnAndOn(argumentOne, argumentTwo, three);\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
