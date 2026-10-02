package linthost

import (
  "path/filepath"
  "testing"
)

// TestCommandFixUnicornSwitchCaseBreakPositionConvergesAndIsIdempotent verifies
// the public `fix` dispatch moves a `break` that follows a case block into the
// block and then leaves the result untouched.
//
// The first invocation must produce parse-valid canonical source; the second
// must leave that exact byte sequence untouched, proving the complete command
// cascade reaches a fixed point instead of merely validating the rule's
// in-memory edits. The authored canonical source, not idempotency alone,
// establishes the first-pass transform.
//
//  1. Seed a `switch` whose braced case block is followed by a sibling `break`
//     and enable the switch-case-break-position rule.
//  2. Run `fix` and assert silent success with the `break` inside the block.
//  3. Run `fix` again and assert the file is byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification The in-process public fix command executes twice and checks its exit/output and exact fixture file after each pass.
// @evidence contracts/testing.md#independent-expectations The authored canonical source and successful silent command contract independently establish the first-pass transform and unchanged second pass, rather than relying only on idempotency.
// @evidence contracts/testing.md#distinguishing-cases The original command fixture must reach exact parse-valid output on pass one and remain identical on pass two; rule-level hosts own individual terminator and no-fix boundaries.
// @evidence contracts/testing.md#execution-ownership TestCommandFixUnicornSwitchCaseBreakPositionConvergesAndIsIdempotent owns these literal cases as a discoverable Go unit entry, retaining named subcase identities where present; actual engine/fix/command functions run in the shared process with isolated fixture files, without installation, native producer or product child host.
func TestCommandFixUnicornSwitchCaseBreakPositionConvergesAndIsIdempotent(t *testing.T) {
  source := `declare const key: string;
switch (key) {
  case "first": {
    void key;
  }
  break;
}
`
  expected := `declare const key: string;
switch (key) {
  case "first": {
    void key;
    break;
  }
}
`
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{switchCaseBreakPositionRule: "error"})
  args := []string{
    "fix",
    "--cwd", root,
    "--plugins-json", lintManifest(t),
  }
  for pass := 1; pass <= 2; pass++ {
    code, stdout, stderr := captureCommandOutput(t, func() int { return run(args) })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("fix pass %d mismatch: code=%d stdout=%q stderr=%q", pass, code, stdout, stderr)
    }
    assertFileText(t, filepath.Join(root, "src", "main.ts"), expected)
  }
}
