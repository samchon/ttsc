package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestFormatClauseJoinLeavesATemplateLiteralTypeUntouched verifies a template
// literal in TYPE position is protected like one in value position.
//
// collectTemplateRanges includes TemplateLiteralType as well as value-template
// forms. The declared template's text is protected content while the labeled
// block's structural indentation changes. This command case requires the final
// payload bytes, without claiming a past corruption was reproduced.
//
//  1. Seed a project with a labeled block declaring a multi-line template type.
//  2. Run `ttsc format`.
//  3. Assert the label joins and the type's interior spacing is byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification The direct formatter must join and outdent a labeled block while preserving multiline text inside its template literal type. Complete source and successful quiet command assertions catch protecting value templates but corrupting type-position payload.
// @evidence contracts/testing.md#independent-expectations Type template text carries its own newline and spaces; those bytes remain literal unchanged expected content while the block and const declaration adopt the supported two-space layout.
// @evidence contracts/testing.md#distinguishing-cases This positive places an interpolated template in a type annotation within an actual labeled Block. HoistsAcrossAMultilineTemplateWithoutMovingIt covers the value-position counterpart, and whitespace-family tests cover shared protected-range use.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinLeavesATemplateLiteralTypeUntouched owns the fixture, direct run(format) cascade and full status/streams/file assertions in the public Go unit population. It performs all operations in process with no consumer install, native artifact build or child product host.
func TestFormatClauseJoinLeavesATemplateLiteralTypeUntouched(t *testing.T) {
  root := seedLintProject(
    t,
    "outer:\n  {\n    const v: `a${string}\n     b` = z;\n  }\n",
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
  want := "outer: {\n  const v: `a${string}\n     b` = z;\n}\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
