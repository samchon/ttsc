package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatAppliesFormatRuleEdits verifies the format command writes
// edits from FormatRule implementations and leaves lint-class rules alone.
//
// `ttsc format` is the format-only convenience subcommand: a user who runs
// it expects formatter-class edits without lint rewrites (the dual
// `ttsc fix` subcommand applies both kinds). This scenario enables a
// format rule and a lint rule on the same project and asserts the file
// changes mirror the format rule's edit set only.
//
// 1. Seed a project with a noVar violation and a missing-semi violation.
// 2. Run the format subcommand with both rules enabled.
// 3. Assert the file gains semicolons but keeps its `var` declaration.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises applies format rule edits and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert the file gains semicolons but keeps its `var` declaration.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a project with a noVar violation and a missing-semi violation. The asserted decision is: Assert the file gains semicolons but keeps its `var` declaration. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatAppliesFormatRuleEdits owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatAppliesFormatRuleEdits(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1\nJSON.stringify(legacy)\n")
  // format/semi is enabled through the format block (the only formatting
  // surface); no-var is a genuine lint rule in the rules map.
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{"semi": true},
    "rules":  map[string]any{"no-var": "error"},
  })
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
  // formatSemi applied: trailing semicolons. noVar did NOT apply: `var`
  // remains (its TextEdit was filtered out because noVar is a lint rule).
  want := "var legacy = 1;\nJSON.stringify(legacy);\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
