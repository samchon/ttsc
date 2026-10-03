package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinChargesTheShiftToTheHeaderLinesIndent verifies the delta is the header line's indent, not the anchor token's column.
//
// In the literal `} else` header the anchor token starts two columns after the
// line's indentation. The multiline labeled-loop fixture requires the final
// continuation columns to follow the header line's indentation rather than
// charge that prefix. The command assertion observes the final output, not
// individual edits or an external formatter result.
//
//  1. Seed a project with a `} else` chain whose body is a labeled loop.
//  2. Run `ttsc format`.
//  3. Assert the complete nested-body output has the independently stated columns.
//
// @evidence contracts/testing.md#behavioral-verification The in-process format entry must flatten the else-if header and outdent the labeled loop by the header line indentation; exact status, streams and file bytes distinguish accidentally adding the } prefix width to continuation columns.
// @evidence contracts/testing.md#independent-expectations The literal canonical layout keeps } else at column zero and the labeled loop one level below its nested if. This formatter contract preserves all branch conditions and visit calls independently of computed edit offsets.
// @evidence contracts/testing.md#distinguishing-cases The } else prefix supplies a nonzero anchor column on a zero-indent line; the labeled loop retains multiline content. ReindentsAHoistedBodyInsideAFunction covers nonzero enclosing indentation.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinChargesTheShiftToTheHeaderLinesIndent is a public Go unit owning its fixture configuration, direct run(format) call, captured streams and filesystem assertion. Project helpers and formatter cascade execute in the same test process; there is no consumer installation, native build or child product host.
func TestFormatClauseJoinChargesTheShiftToTheHeaderLinesIndent(t *testing.T) {
  root := seedLintProject(t, "if (a) {\n  x();\n} else\n  if (b)\n    outer: for (const x of xs) {\n      visit(x);\n    }\n")
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
  if want := "if (a) {\n  x();\n} else if (b)\n  outer: for (const x of xs) {\n    visit(x);\n  }\n"; string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
