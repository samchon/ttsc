package linthost

import (
  "path/filepath"
  "testing"
)

// TestCommandFixUnicornTemplateIndentConvergesAndIsIdempotent verifies that the in-process public fix command executes twice and checks silent success plus the exact fixture file after each pass.
//
// Authored canonical source independently establishes both the first transform and unchanged second pass rather than idempotency alone.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The in-process public fix command executes twice and checks silent success plus the exact fixture file after each pass.
// @evidence contracts/testing.md#independent-expectations Authored canonical source independently establishes both the first transform and unchanged second pass rather than idempotency alone.
// @evidence contracts/testing.md#distinguishing-cases The original command fixture must reach the full expected source on pass one and preserve it on pass two.
// @evidence contracts/testing.md#execution-ownership TestCommandFixUnicornTemplateIndentConvergesAndIsIdempotent owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestCommandFixUnicornTemplateIndentConvergesAndIsIdempotent(t *testing.T) {
  source := "declare const ready: boolean;\n" +
    "declare function use(): void;\n" +
    "declare function gql(strings: TemplateStringsArray): string;\n" +
    "if (ready) {\n  use();\n}\n" +
    "const query = gql`\none\n  child\n`;\n"
  expected := "declare const ready: boolean;\n" +
    "declare function use(): void;\n" +
    "declare function gql(strings: TemplateStringsArray): string;\n" +
    "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n  one\n    child\n`;\n"
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{unicornTemplateIndentRuleName: "error"})
  args := []string{"fix", "--cwd", root, "--plugins-json", lintManifest(t)}
  for pass := 1; pass <= 2; pass++ {
    code, stdout, stderr := captureCommandOutput(t, func() int { return run(args) })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("fix pass %d mismatch: code=%d stdout=%q stderr=%q", pass, code, stdout, stderr)
    }
    assertFileText(t, filepath.Join(root, "src", "main.ts"), expected)
  }
}
