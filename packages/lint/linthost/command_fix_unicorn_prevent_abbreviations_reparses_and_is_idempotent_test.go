package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixUnicornPreventAbbreviationsReparsesAndIsIdempotent verifies that in-process public fix dispatch executes twice and compares the final fixture with authored canonical shorthand output.
//
// The supported binding rename and shorthand-key preservation independently establish the complete expected source beyond idempotency alone.
//
// @evidence contracts/testing.md#behavioral-verification In-process public fix dispatch executes twice and compares the final fixture with authored canonical shorthand output.
// @evidence contracts/testing.md#independent-expectations The supported binding rename and shorthand-key preservation independently establish the complete expected source beyond idempotency alone.
// @evidence contracts/testing.md#distinguishing-cases idx declaration and shorthand become index/idx:index and remain stable on the second command pass.
// @evidence contracts/testing.md#execution-ownership TestCommandFixUnicornPreventAbbreviationsReparsesAndIsIdempotent owns its explicit variants and named subcases where present as a discoverable Go unit entry; Two in-process public fix dispatches, checker-backed binding analysis and disk edit application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestCommandFixUnicornPreventAbbreviationsReparsesAndIsIdempotent(t *testing.T) {
  root := seedLintProject(t, "const idx = 0;\nconsole.log({ idx });\n")
  seedLintRules(t, root, map[string]string{unicornPreventAbbreviationsRuleName: "error"})
  for pass := 1; pass <= 2; pass++ {
    code, stdout, stderr := captureCommandOutput(t, func() int {
      return run([]string{"fix", "--cwd", root, "--plugins-json", lintManifest(t)})
    })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("fix pass %d mismatch: code=%d stdout=%q stderr=%q", pass, code, stdout, stderr)
    }
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  want := "const index = 0;\nconsole.log({ idx: index });\n"
  if string(got) != want {
    t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
