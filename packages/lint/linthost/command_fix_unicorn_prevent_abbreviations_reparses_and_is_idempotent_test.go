package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixUnicornPreventAbbreviationsReparsesAndIsIdempotent verifies that in-process public fix dispatch executes twice and compares the final fixture with authored canonical shorthand output.
//
// The authored full literal renames the idx binding to index while retaining the public object key idx and all remaining bytes. Comparing it after each invocation establishes first-call correctness separately from second-call stability.
//
// @evidence contracts/testing.md#behavioral-verification Each of two in-process fix calls returns zero with empty streams and writes the complete authored index declaration/idx:index shorthand output.
// @evidence contracts/testing.md#independent-expectations The authored full literal renames the idx binding to index while retaining the public object key idx and all remaining bytes. Comparing it after each invocation establishes first-call correctness separately from second-call stability.
// @evidence contracts/testing.md#distinguishing-cases idx declaration and shorthand become index/idx:index and remain stable on the second command pass.
// @evidence contracts/testing.md#execution-ownership This single discoverable Go unit entry runs two real fix invocations, checker-backed binding analysis and disk reads/writes on one isolated authored project; no dynamic subcases, installed consumer, native producer or product child runs.
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
    assertFileText(t, filepath.Join(root, "src", "main.ts"), "const index = 0;\nconsole.log({ idx: index });\n")
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
