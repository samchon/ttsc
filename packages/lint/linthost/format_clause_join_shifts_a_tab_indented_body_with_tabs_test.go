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
//
// @evidence contracts/testing.md#behavioral-verification The direct formatter must flatten the short chain and retain a tab on the remaining long-call body under useTabs. Exact file bytes and quiet success detect rendering a shifted continuation in spaces or incorrectly joining the overlong call.
// @evidence contracts/testing.md#independent-expectations The supported useTabs option determines a tab indentation unit, while the width budget leaves the long call below its header. Literal expected output preserves all arguments and their order independently of the layout renderer.
// @evidence contracts/testing.md#distinguishing-cases The fixture has tab-indented nested clauses and an over-width final call, so a shifted body remains observable after convergence. Space-indent and nested-function hosts cover other destination columns.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinShiftsATabIndentedBodyWithTabs owns its fixture config, direct run(format) call and exact file/status/stream assertions in the public Go unit population. No consumer install, native artifact builder or child host is invoked.
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
